// Firestore data-layer for attendance records + office settings.
// Collection: attendance/{uid}_{date} — one document per employee per day.
// Collection: settings/office — global office configuration.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  DEFAULT_OFFICE_SETTINGS,
  type AttendanceRecord,
  type AttendanceStatus,
  type OfficeSettings,
  type Developer,
} from "@/lib/data/types";

const COL = "attendance";

// Build a deterministic doc id so there's exactly one record per user per day.
function recordId(uid: string, date: string): string {
  return `${uid}_${date}`;
}

// ---------------------------------------------------------------------------
// Office Settings
// ---------------------------------------------------------------------------

/** Subscribe to the global office settings document. */
export function subscribeToOfficeSettings(
  onData: (settings: OfficeSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "settings", "office"),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as OfficeSettings);
      } else {
        onData(DEFAULT_OFFICE_SETTINGS);
      }
    },
    onError,
  );
}

/** Admin: update the global office settings. */
export async function updateOfficeSettings(
  settings: Partial<OfficeSettings>,
): Promise<void> {
  await setDoc(doc(db, "settings", "office"), settings, { merge: true });
}

// ---------------------------------------------------------------------------
// Late / overtime detection helpers
// ---------------------------------------------------------------------------

/** Check if a check-in time is considered late given office settings. */
export function isCheckInLate(
  checkInIso: string,
  settings: OfficeSettings,
): boolean {
  const checkIn = new Date(checkInIso);
  // The deadline is start time + grace minutes.
  const deadline = new Date(checkIn);
  deadline.setHours(settings.startHour, settings.startMinute, 0, 0);
  deadline.setMinutes(deadline.getMinutes() + settings.graceMinutes);
  return checkIn > deadline;
}

/** Check if currently within allowed clock-in/out window. */
export function isWithinOfficeHours(settings: OfficeSettings): boolean {
  const now = new Date();
  const start = new Date(now);
  start.setHours(settings.startHour, settings.startMinute, 0, 0);
  // Allow clock-out up to 4 hours after office end (for overtime).
  const end = new Date(now);
  end.setHours(settings.endHour + 4, settings.endMinute, 0, 0);
  return now >= start && now <= end;
}

/** Calculate overtime minutes (how many minutes past office end time). */
function calcOvertimeMinutes(
  checkOutIso: string,
  settings: OfficeSettings,
): number {
  const checkOut = new Date(checkOutIso);
  const endTime = new Date(checkOut);
  endTime.setHours(settings.endHour, settings.endMinute, 0, 0);
  const diff = (checkOut.getTime() - endTime.getTime()) / 60_000;
  return Math.max(0, Math.round(diff));
}

// ---------------------------------------------------------------------------
// Subscribe to attendance records
// ---------------------------------------------------------------------------

/** Subscribe to ALL attendance records (admin view). */
export function subscribeToAllAttendance(
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COL), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord),
      ),
    onError,
  );
}

/** Subscribe to a single employee's attendance records. */
export function subscribeToMyAttendance(
  uid: string,
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // We avoid orderBy("date", "desc") here to prevent requiring a composite index
  // (uid + date). Instead, we sort the results in memory.
  const q = query(
    collection(db, COL),
    where("uid", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord);
      records.sort((a, b) => b.date.localeCompare(a.date));
      onData(records);
    },
    onError,
  );
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/** Clock in for the current user. Auto-detects if late. */
export async function clockIn(
  employee: Developer,
  settings: OfficeSettings,
): Promise<{ status: "success" | "warning"; message: string }> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const uid = employee.uid!;
  const id = recordId(uid, date);
  const checkInIso = now.toISOString();

  if (!employee.startDate) {
    await updateDoc(doc(db, "developers", employee.id), {
      startDate: date,
    });
  }

  const officeStart = new Date(now);
  officeStart.setHours(settings.startHour, settings.startMinute, 0, 0);
  const diffMs = now.getTime() - officeStart.getTime();
  const lateMinutes = Math.max(0, Math.floor(diffMs / 60000));

  let isLate = isCheckInLate(checkInIso, settings);
  let status: AttendanceStatus = isLate ? "late" : "present";
  let flexibilityUsed = 0;
  let returnResult: { status: "success" | "warning"; message: string } = { status: "success", message: "Clocked in successfully." };

  if (isLate && employee.flexibilityHours) {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    // We query only by uid to avoid needing a composite index, then filter in memory.
    const q = query(
      collection(db, COL),
      where("uid", "==", uid)
    );
    const snap = await getDocs(q);
    let usedFlex = 0;
    snap.forEach((d) => {
      const rec = d.data() as AttendanceRecord;
      if (rec.date >= weekStartIso && rec.date <= date) {
        if (rec.flexibilityUsed) usedFlex += rec.flexibilityUsed;
      }
    });

    const allowedFlexMinutes = employee.flexibilityHours * 60;
    const remainingFlex = allowedFlexMinutes - usedFlex;

    if (remainingFlex >= lateMinutes) {
      status = "present";
      isLate = false;
      flexibilityUsed = lateMinutes;
      returnResult = {
        status: "success",
        message: `Clocked in! You used ${lateMinutes}m of flex time. (${remainingFlex - lateMinutes}m remaining this week)`,
      };
    } else {
      status = "late";
      flexibilityUsed = Math.max(0, remainingFlex);
      returnResult = {
        status: "warning",
        message: `Clocked in late. You were late by ${lateMinutes}m but only had ${Math.max(0, remainingFlex)}m of flex time remaining.`,
      };
    }
  }

  await setDoc(doc(db, COL, id), {
    uid,
    employeeName: employee.name,
    date,
    checkIn: checkInIso,
    checkOut: null,
    status,
    hoursWorked: 0,
    isLate,
    flexibilityUsed,
    isOvertime: false,
    overtimeMinutes: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return returnResult;
}

/** Clock out — sets checkOut, calculates hoursWorked and overtime. */
export async function clockOut(
  uid: string,
  settings: OfficeSettings,
): Promise<void> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const id = recordId(uid, date);
  const docRef = doc(db, COL, id);
  
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  
  const data = snap.data();
  const checkInIso = data.checkIn;
  const checkOutIso = now.toISOString();
  
  const hoursWorked = Math.max(
    0,
    (now.getTime() - new Date(checkInIso).getTime()) / 3_600_000,
  );
  const overtime = calcOvertimeMinutes(checkOutIso, settings);

  await updateDoc(docRef, {
    checkOut: checkOutIso,
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    isOvertime: overtime > 0,
    overtimeMinutes: overtime,
    updatedAt: serverTimestamp(),
  });
}

/** Admin: manually mark attendance for any employee. */
export async function markAttendance(
  uid: string,
  employeeName: string,
  date: string,
  status: AttendanceStatus,
  settings: OfficeSettings,
  checkIn?: string | null,
  checkOut?: string | null,
): Promise<void> {
  const id = recordId(uid, date);
  let hoursWorked = 0;
  let overtime = 0;
  let isLate = false;
  let isOvertime = false;

  if (checkIn) {
    isLate = isCheckInLate(checkIn, settings);
  }
  if (checkIn && checkOut) {
    hoursWorked = Math.max(
      0,
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000,
    );
    overtime = calcOvertimeMinutes(checkOut, settings);
    isOvertime = overtime > 0;
  }

  await setDoc(
    doc(db, COL, id),
    {
      uid,
      employeeName,
      date,
      checkIn: checkIn ?? null,
      checkOut: checkOut ?? null,
      status: status === "present" && isLate ? "late" : status,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      isLate,
      isOvertime,
      overtimeMinutes: overtime,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Update an existing attendance record (partial). */
export async function updateAttendance(
  id: string,
  patch: Partial<Omit<AttendanceRecord, "id">>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Delete an attendance record. */
export async function deleteAttendance(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

// ---------------------------------------------------------------------------
// Monthly summary computation (runs client-side on the fetched records)
// ---------------------------------------------------------------------------

export interface MonthlySummary {
  totalPresent: number;
  totalLate: number;
  totalLeaves: number;
  totalAbsent: number;
  totalHalfDays: number;
  totalHoursWorked: number;
  totalOvertimeMinutes: number;
  lateDaysOverThreshold: number; // late days beyond allowed threshold
  excessLeaves: number; // leaves beyond allowed quota
  deductionDays: number; // total deduction days (half-day for late + full-day for excess leave)
}

export function computeMonthlySummary(
  records: AttendanceRecord[],
  settings: OfficeSettings,
  isIntern: boolean,
): MonthlySummary {
  let totalPresent = 0;
  let totalLate = 0;
  let totalLeaves = 0;
  let totalAbsent = 0;
  let totalHalfDays = 0;
  let totalHoursWorked = 0;
  let totalOvertimeMinutes = 0;

  for (const r of records) {
    switch (r.status) {
      case "present":
        totalPresent++;
        break;
      case "late":
        totalLate++;
        break;
      case "on_leave":
        totalLeaves++;
        break;
      case "absent":
        totalAbsent++;
        break;
      case "half_day":
        totalHalfDays++;
        break;
    }
    
    let hw = r.hoursWorked || 0;
    let ot = r.overtimeMinutes || 0;
    
    // Dynamically calculate if 0 (e.g., currently clocked in or old record missing hours)
    if (hw === 0 && r.checkIn) {
      const outTime = r.checkOut ? new Date(r.checkOut) : new Date();
      hw = Math.max(0, (outTime.getTime() - new Date(r.checkIn).getTime()) / 3_600_000);
      ot = r.checkOut ? calcOvertimeMinutes(r.checkOut, settings) : 0;
    }
    
    totalHoursWorked += hw;
    totalOvertimeMinutes += ot;
  }

  const allowedLeaves = isIntern
    ? settings.internLeavesPerMonth
    : settings.employeeLeavesPerMonth;

  const excessLeaves = Math.max(0, totalLeaves - allowedLeaves);

  // Late penalty: after threshold late days, every late day costs 0.5 day salary.
  // BUT overtime can offset late penalties: each 480 min (8h) of overtime
  // offsets 1 late penalty. We count gross late penalty first, then subtract
  // the overtime offset.
  const grossLatePenalties = Math.max(
    0,
    totalLate - settings.lateThresholdDays,
  );
  const overtimeOffsetDays = Math.floor(totalOvertimeMinutes / 480);
  const lateDaysOverThreshold = Math.max(
    0,
    grossLatePenalties - overtimeOffsetDays,
  );

  // Each excess late day = 0.5 day deduction; each excess leave = 1 day deduction.
  const deductionDays = lateDaysOverThreshold * 0.5 + excessLeaves;

  return {
    totalPresent,
    totalLate,
    totalLeaves,
    totalAbsent,
    totalHalfDays,
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    totalOvertimeMinutes,
    lateDaysOverThreshold,
    excessLeaves,
    deductionDays,
  };
}
