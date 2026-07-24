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
  type DailyTask,
} from "@/lib/data/types";
import { logAdminAction } from "./logs";

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
  await logAdminAction("Updated Office Settings", `Updated office config: ${Object.keys(settings).join(", ")}`);
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

  // Check if a record already exists for today (e.g., approved leave)
  const docRef = doc(db, COL, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data() as AttendanceRecord;
    if (data.status === "sick_leave" || data.status === "on_leave") {
      return { status: "warning", message: "You can't clock in today you are on a leave." };
    }
    if (data.checkIn) {
      return { status: "warning", message: "Already clocked in today." };
    }
  }

  if (!employee.startDate) {
    await updateDoc(doc(db, "developers", employee.id), {
      startDate: date,
    });
  }

  let isLate = false;
  let lateMinutes = 0;

  if (employee.accessLevel === "intern") {
    const dailyHours = (employee.officeHours || 30) / 5;
    const requiredMinutes = dailyHours * 60;
    
    const officeEnd = new Date(now);
    officeEnd.setHours(settings.endHour, settings.endMinute, 0, 0);
    
    const remainingMinutes = Math.floor((officeEnd.getTime() - now.getTime()) / 60000);
    
    if (remainingMinutes < requiredMinutes) {
      isLate = true;
      lateMinutes = requiredMinutes - remainingMinutes;
    }
  } else {
    const officeStart = new Date(now);
    officeStart.setHours(settings.startHour, settings.startMinute, 0, 0);
    const diffMs = now.getTime() - officeStart.getTime();
    lateMinutes = Math.max(0, Math.floor(diffMs / 60000));
    isLate = isCheckInLate(checkInIso, settings);
  }
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
      
      const formatMin = (m: number) => {
        if (m < 60) return `${m}m`;
        const hrs = Math.floor(m / 60);
        const mins = m % 60;
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
      };
      
      returnResult = {
        status: "success",
        message: `Clocked in! You used ${formatMin(lateMinutes)} of flex time. (${formatMin(remainingFlex - lateMinutes)} remaining this week)`,
      };
    } else {
      status = "late";
      flexibilityUsed = Math.max(0, remainingFlex);
      
      const formatMin = (m: number) => {
        if (m < 60) return `${m}m`;
        const hrs = Math.floor(m / 60);
        const mins = m % 60;
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
      };

      returnResult = {
        status: "warning",
        message: `Clocked in late. You were late by ${formatMin(lateMinutes)} but only had ${formatMin(Math.max(0, remainingFlex))} of flex time remaining.`,
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
  settings: OfficeSettings
): Promise<{ status: "success" | "warning" | "error"; message: string }> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const id = recordId(uid, date);
  const docRef = doc(db, COL, id);
  
  const snap = await getDoc(docRef);
  if (!snap.exists()) return { status: "error", message: "No check-in record found for today." };
  
  const data = snap.data() as AttendanceRecord;
  if (data.status === "sick_leave" || data.status === "on_leave") {
    return { status: "warning", message: "You can't clock out today you are on a leave." };
  }
  
  const checkInIso = data.checkIn;
  if (!checkInIso) {
    return { status: "error", message: "You haven't checked in today." };
  }

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
  
  return { status: "success", message: "Clocked out successfully." };
}

/** 
 * Session Manager Helper: finds any open shifts (checkOut: null) for the user.
 * If the shift is from a previous day, or today but past office end time, it
 * auto-closes the shift exactly at the official office end time.
 */
/** Helper to safely get YYYY-MM-DD in the local timezone */
function getLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function autoClockOutUnclosedShifts(
  uid: string,
  settings: OfficeSettings
): Promise<void> {
  const q = query(
    collection(db, COL),
    where("uid", "==", uid),
    where("checkOut", "==", null)
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return;
  
  const now = new Date();
  const todayStr = getLocalISODate(now);
  
  const todayEnd = new Date(now);
  todayEnd.setHours(settings.endHour, settings.endMinute, 0, 0);
  
  const batchUpdates = [];
  
  for (const d of snap.docs) {
    const data = d.data() as AttendanceRecord;
    
    // Only auto clock out if they actually clocked in!
    if (!data.checkIn) continue;
    
    let shouldClose = false;
    if (data.date < todayStr) {
      shouldClose = true;
    } else if (data.date === todayStr && now > todayEnd) {
      shouldClose = true;
    }
    
    if (shouldClose) {
      const closingDate = new Date(data.date + "T00:00:00");
      closingDate.setHours(settings.endHour, settings.endMinute, 0, 0);
      
      const checkOutIso = closingDate.toISOString();
      const hoursWorked = Math.max(0, (closingDate.getTime() - new Date(data.checkIn).getTime()) / 3_600_000);
      
      batchUpdates.push(
        updateDoc(d.ref, {
          checkOut: checkOutIso,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          isOvertime: false,
          overtimeMinutes: 0,
          updatedAt: serverTimestamp(),
        })
      );
    }
  }
  
  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
}

export async function autoClockOutAllUnclosedShifts(
  settings: OfficeSettings
): Promise<void> {
  const q = query(
    collection(db, COL),
    where("checkOut", "==", null)
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return;
  
  const now = new Date();
  const todayStr = getLocalISODate(now);
  
  const todayEnd = new Date(now);
  todayEnd.setHours(settings.endHour, settings.endMinute, 0, 0);
  
  const batchUpdates = [];
  
  for (const d of snap.docs) {
    const data = d.data() as AttendanceRecord;
    
    // Only auto clock out if they actually clocked in!
    if (!data.checkIn) continue;
    
    let shouldClose = false;
    if (data.date < todayStr) {
      shouldClose = true;
    } else if (data.date === todayStr && now > todayEnd) {
      shouldClose = true;
    }
    
    if (shouldClose) {
      const closingDate = new Date(data.date + "T00:00:00");
      closingDate.setHours(settings.endHour, settings.endMinute, 0, 0);
      
      const checkOutIso = closingDate.toISOString();
      const hoursWorked = Math.max(0, (closingDate.getTime() - new Date(data.checkIn).getTime()) / 3_600_000);
      
      batchUpdates.push(
        updateDoc(d.ref, {
          checkOut: checkOutIso,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          isOvertime: false,
          overtimeMinutes: 0,
          updatedAt: serverTimestamp(),
        })
      );
    }
  }
  
  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
}

/** 
 * Auto-fills missing working days as on_leave or absent.
 * Skips weekends (Saturday, Sunday) and skips today.
 */
export async function autoFillMissingAttendance(
  employee: Developer,
  settings: OfficeSettings
): Promise<void> {
  if (!employee.startDate || !employee.uid) return;

  const uid = employee.uid;
  const q = query(collection(db, COL), where("uid", "==", uid));
  const snap = await getDocs(q);
  
  const existingRecords = new Map<string, AttendanceRecord>();
  snap.forEach(d => {
    const rec = d.data() as AttendanceRecord;
    existingRecords.set(rec.date, rec);
  });

  const now = new Date();
  const todayStr = getLocalISODate(now);
  
  const start = new Date(employee.startDate + "T00:00:00");

  const allowedLeaves = employee.accessLevel === "intern" 
    ? settings.internLeavesPerMonth 
    : settings.employeeLeavesPerMonth;

  const batchUpdates = [];

  // Iterate from start date up to yesterday
  const curr = new Date(start);
  while (true) {
    const dateStr = getLocalISODate(curr);
    if (dateStr >= todayStr) break;

    const dayOfWeek = curr.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend && !existingRecords.has(dateStr)) {
      const monthPrefix = dateStr.slice(0, 7);
      
      let leavesThisMonth = 0;
      for (const rec of existingRecords.values()) {
        if (rec.date.startsWith(monthPrefix) && rec.status === "on_leave") {
          leavesThisMonth++;
        }
      }

      const status: AttendanceStatus = leavesThisMonth < allowedLeaves ? "on_leave" : "absent";
      
      const id = recordId(uid, dateStr);
      const newRec: Partial<AttendanceRecord> = {
        uid,
        employeeName: employee.name,
        date: dateStr,
        checkIn: null,
        checkOut: null,
        status,
        hoursWorked: 0,
        isLate: false,
        isOvertime: false,
        overtimeMinutes: 0,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };
      
      batchUpdates.push(setDoc(doc(db, COL, id), newRec));
      existingRecords.set(dateStr, newRec as AttendanceRecord);
    }
    
    curr.setDate(curr.getDate() + 1);
  }

  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
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
  await logAdminAction("Marked Attendance", `Marked attendance for ${employeeName} on ${date} as ${status}`);
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
  const updates = Object.keys(patch).join(", ");
  await logAdminAction("Updated Attendance", `Updated attendance (ID: ${id}) fields: ${updates}`);
}

/** Delete an attendance record. */
export async function deleteAttendance(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await logAdminAction("Deleted Attendance", `Deleted attendance record (ID: ${id})`);
}

// ---------------------------------------------------------------------------
// Monthly summary computation (runs client-side on the fetched records)
// ---------------------------------------------------------------------------

export interface MonthlySummary {
  totalPresent: number;
  totalLate: number;
  totalLeaves: number;
  totalSickLeaves: number;
  totalAbsent: number;
  totalHoursWorked: number;
  totalOvertimeMinutes: number;
  lateDaysOverThreshold: number; // late days beyond allowed threshold
  excessLeaves: number; // leaves beyond allowed quota
  deductionDays: number; // total deduction days (half-day for late + full-day for excess leave)
  overtimeDueMinutes?: number; // only applicable for interns
}

export function computeMonthlySummary(
  records: AttendanceRecord[],
  tasks: DailyTask[],
  settings: OfficeSettings,
  isIntern: boolean,
  employee?: Pick<Developer, "officeHours">
): MonthlySummary {
  let totalPresent = 0;
  let totalLate = 0;
  let totalLeaves = 0;
  let totalSickLeaves = 0;
  let totalAbsent = 0;
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
      case "sick_leave":
        totalSickLeaves++;
        break;
      case "absent":
        totalAbsent++;
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

  for (const t of tasks) {
    if (t.status === "done" && t.isOvertime && t.compensatesWeeklyHours) {
      totalHoursWorked += (Number(t.assignedHours) || 0);
      totalOvertimeMinutes += (Number(t.assignedHours) || 0) * 60;
    }
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
  
  if (isIntern) {
    // Intern penalty logic: penalties become negative overtime (overtimeDue).
    const dailyHours = (employee?.officeHours || 30) / 5;
    const dailyMinutes = dailyHours * 60;
    
    // Total missing minutes from absentees and excess leaves
    const missingMinutesFromAbsences = (totalAbsent + excessLeaves) * dailyMinutes;
    // Missing minutes from late days over threshold
    const missingMinutesFromLates = grossLatePenalties * (dailyMinutes / 2);
    
    const totalPenaltyMinutes = missingMinutesFromAbsences + missingMinutesFromLates;
    
    const netOvertime = totalOvertimeMinutes - totalPenaltyMinutes;
    
    return {
      totalPresent,
      totalLate,
      totalLeaves,
      totalSickLeaves,
      totalAbsent,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalOvertimeMinutes: Math.max(0, netOvertime),
      lateDaysOverThreshold: 0,
      excessLeaves: 0,
      deductionDays: 0,
      overtimeDueMinutes: netOvertime < 0 ? Math.abs(netOvertime) : 0,
    };
  } else {
    // Employee penalty logic: deduction days and offset with overtime
    const overtimeOffsetDays = Math.floor(totalOvertimeMinutes / 480);
    const lateDaysOverThreshold = Math.max(
      0,
      grossLatePenalties - overtimeOffsetDays,
    );

    // Each excess late day = 0.5 day deduction; each excess leave = 1 day deduction. Each absent day = 1 day deduction.
    const deductionDays = lateDaysOverThreshold * 0.5 + excessLeaves + totalAbsent;

    return {
      totalPresent,
      totalLate,
      totalLeaves,
      totalSickLeaves,
      totalAbsent,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalOvertimeMinutes,
      lateDaysOverThreshold,
      excessLeaves,
      deductionDays,
    };
  }
}
