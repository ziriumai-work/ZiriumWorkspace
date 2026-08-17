// Attendance write operations: clocking in/out, shift auto-closures, manual marks, and updates.

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Developer,
  OfficeSettings,
} from "@/lib/data/types";
import { logAdminAction } from "../logs";
import {
  calcOvertimeMinutes,
  calculateDynamicAllowedLeaves,
  getLocalISODate,
  isCheckInLate,
} from "./calculations";
import { normalizeOfficeHours } from "./settings";

const COL = "attendance";

function recordId(uid: string, date: string): string {
  return `${uid}_${date}`;
}

async function fetchSubscribedAdminEmails(): Promise<string[]> {
  const emailsSet = new Set<string>();
  try {
    const memSnap = await getDocs(collection(db, "members"));
    memSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if ((data.role === "owner" || data.role === "admin") && data.subscribeToEmails === true && data.email) {
        emailsSet.add(data.email as string);
      }
    });
  } catch (err) {
    console.warn("Could not fetch members email list:", err);
  }

  try {
    const devSnap = await getDocs(collection(db, "developers"));
    devSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.accessLevel === "admin" && data.subscribeToEmails === true && data.email) {
        emailsSet.add(data.email as string);
      }
    });
  } catch {
    // Non-admins cannot read developers collection, ignore silently
  }
  return Array.from(emailsSet);
}

export async function clockIn(
  employee: Developer,
  settings: OfficeSettings,
): Promise<{ status: "success" | "warning"; message: string }> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const uid = employee.uid || employee.id;
  const id = recordId(uid, date);
  const checkInIso = now.toISOString();

  // Check if a record already exists for today (e.g., approved leave)
  const docRef = doc(db, COL, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data() as AttendanceRecord;
    if (data.status === "sick_leave" || data.status === "on_leave") {
      return {
        status: "warning",
        message: "You can't clock in today you are on a leave.",
      };
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

  const defaultWeeklyHours = employee.accessLevel === "intern" ? 30 : 40;
  const dailyHours = (employee.officeHours || defaultWeeklyHours) / 5;
  const requiredMinutes = dailyHours * 60;

  const officeStart = new Date(now);
  officeStart.setHours(settings.startHour, settings.startMinute, 0, 0);

  const graceDeadline = new Date(officeStart);
  graceDeadline.setMinutes(graceDeadline.getMinutes() + (settings.graceMinutes || 0));

  const officeEnd = new Date(now);
  officeEnd.setHours(settings.endHour, settings.endMinute, 0, 0);

  const remainingOfficeMinutes = Math.floor((officeEnd.getTime() - now.getTime()) / 60000);
  const shortBy = requiredMinutes - remainingOfficeMinutes;
  const grace = settings.graceMinutes || 0;

  lateMinutes = 0;
  if (shortBy > grace) {
    isLate = true;
    lateMinutes = shortBy - grace;
  } else {
    isLate = false;
    lateMinutes = 0;
  }
  let status: AttendanceStatus = isLate ? "late" : "present";
  let flexibilityUsed = 0;
  let returnResult: { status: "success" | "warning"; message: string } = {
    status: "success",
    message: "Clocked in successfully.",
  };

  if (isLate && employee.flexibilityHours) {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    const q = query(collection(db, COL), where("uid", "==", uid));
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

  if (employee.accessLevel !== "admin") {
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      "Triggering admin email notification for Clock In:",
      employee.name,
    );
    fetchSubscribedAdminEmails().then(async (adminEmails) => {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      fetch("/api/attendance/notify-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          userName: employee.name,
          userEmail: employee.email,
          userAvatar: employee.photoURL,
          action: "Clock In",
          exactTime: timeStr,
          adminEmails,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.warn("Admin notify email response error (Clock In):", res.status, text);
            return;
          }
          const data = await res.json();
          console.log("Admin notify email response (Clock In):", data);
        })
        .catch((err) => console.error("Admin notify error:", err));
    });
  }

  return returnResult;
}

export async function clockOut(
  uid: string,
  settings: OfficeSettings,
  employee?: Developer,
): Promise<{ status: "success" | "warning" | "error"; message: string }> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const id = recordId(uid, date);
  const docRef = doc(db, COL, id);

  const snap = await getDoc(docRef);
  if (!snap.exists())
    return { status: "error", message: "No check-in record found for today." };

  const data = snap.data() as AttendanceRecord;
  if (data.status === "sick_leave" || data.status === "on_leave") {
    return {
      status: "warning",
      message: "You can't clock out today you are on a leave.",
    };
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

  let emp = employee;
  if (!emp) {
    try {
      const devSnap = await getDoc(doc(db, "developers", uid));
      if (devSnap.exists()) {
        emp = { id: devSnap.id, ...devSnap.data() } as Developer;
      }
    } catch (err) {
      // ignore
    }
  }

  if (emp && emp.accessLevel !== "admin") {
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      "Triggering admin email notification for Clock Out:",
      emp?.name || uid,
    );
    fetchSubscribedAdminEmails().then(async (adminEmails) => {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      fetch("/api/attendance/notify-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          userName: emp?.name || "Employee",
          userEmail: emp?.email || "",
          userAvatar: emp?.photoURL || "",
          action: "Clock Out",
          exactTime: timeStr,
          adminEmails,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.warn("Admin notify email response error (Clock Out):", res.status, text);
            return;
          }
          const data = await res.json();
          console.log("Admin notify email response (Clock Out):", data);
        })
        .catch((err) => console.error("Admin notify error:", err));
    });
  }

  return { status: "success", message: "Clocked out successfully." };
}

export async function autoClockOutUnclosedShifts(
  uid: string,
  settings: OfficeSettings,
): Promise<void> {
  const q = query(
    collection(db, COL),
    where("uid", "==", uid),
    where("checkOut", "==", null),
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  const now = new Date();
  const todayStr = getLocalISODate(now);

  const { startH, endH, endM } = normalizeOfficeHours(settings);

  const todayEnd = new Date(now);
  todayEnd.setHours(endH, endM, 0, 0);

  const batchUpdates = [];

  for (const d of snap.docs) {
    const data = d.data() as AttendanceRecord;
    if (!data.checkIn) continue;

    let shouldClose = false;
    if (endH < startH) {
      // Overnight shift (e.g. 10 PM to 6 AM): close shift from previous date once morning closing time passes
      if (data.date < todayStr && now > todayEnd) {
        shouldClose = true;
      }
    } else {
      // Regular daytime shift
      if (data.date < todayStr) {
        shouldClose = true;
      } else if (data.date === todayStr && now > todayEnd) {
        shouldClose = true;
      }
    }

    if (shouldClose) {
      const closingDate = new Date(data.date + "T00:00:00");
      if (endH < startH) {
        closingDate.setDate(closingDate.getDate() + 1);
      }
      closingDate.setHours(endH, endM, 0, 0);

      const checkOutIso = closingDate.toISOString();
      const hoursWorked = Math.max(
        0,
        (closingDate.getTime() - new Date(data.checkIn).getTime()) / 3_600_000,
      );

      batchUpdates.push(
        updateDoc(d.ref, {
          checkOut: checkOutIso,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          isOvertime: false,
          overtimeMinutes: 0,
          updatedAt: serverTimestamp(),
        }),
      );
    }
  }

  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
}

export async function autoClockOutAllUnclosedShifts(
  settings: OfficeSettings,
): Promise<void> {
  const q = query(collection(db, COL), where("checkOut", "==", null));

  const snap = await getDocs(q);
  if (snap.empty) return;

  const now = new Date();
  const todayStr = getLocalISODate(now);

  const { startH, endH, endM } = normalizeOfficeHours(settings);

  const todayEnd = new Date(now);
  todayEnd.setHours(endH, endM, 0, 0);

  const batchUpdates = [];

  for (const d of snap.docs) {
    const data = d.data() as AttendanceRecord;
    if (!data.checkIn) continue;

    let shouldClose = false;
    if (endH < startH) {
      // Overnight shift (e.g. 10 PM to 6 AM): close shift from previous date once morning closing time passes
      if (data.date < todayStr && now > todayEnd) {
        shouldClose = true;
      }
    } else {
      // Regular daytime shift
      if (data.date < todayStr) {
        shouldClose = true;
      } else if (data.date === todayStr && now > todayEnd) {
        shouldClose = true;
      }
    }

    if (shouldClose) {
      const closingDate = new Date(data.date + "T00:00:00");
      if (endH < startH) {
        closingDate.setDate(closingDate.getDate() + 1);
      }
      closingDate.setHours(endH, endM, 0, 0);

      const checkOutIso = closingDate.toISOString();
      const hoursWorked = Math.max(
        0,
        (closingDate.getTime() - new Date(data.checkIn).getTime()) / 3_600_000,
      );

      batchUpdates.push(
        updateDoc(d.ref, {
          checkOut: checkOutIso,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          isOvertime: false,
          overtimeMinutes: 0,
          updatedAt: serverTimestamp(),
        }),
      );
    }
  }

  if (batchUpdates.length > 0) {
    await Promise.all(batchUpdates);
  }
}

export async function autoFillMissingAttendance(
  employee: Developer,
  settings: OfficeSettings,
): Promise<void> {
  const uid = employee.uid || employee.id;
  if (!uid) return;

  const q = query(collection(db, COL), where("uid", "==", uid));
  const snap = await getDocs(q);

  const existingRecords = new Map<string, AttendanceRecord>();
  snap.forEach((d) => {
    const rec = d.data() as AttendanceRecord;
    existingRecords.set(rec.date, rec);
  });

  const now = new Date();
  const todayStr = getLocalISODate(now);
  
  let startStr = employee.startDate;
  if (!startStr) {
    startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const start = new Date(startStr + "T00:00:00");

  const batchUpdates = [];

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

      const dynamicAllowedLeaves = calculateDynamicAllowedLeaves({
        employee,
        settings,
        targetMonthStr: monthPrefix,
        allAttendanceRecords: Array.from(existingRecords.values()),
      });
      const status: AttendanceStatus =
        leavesThisMonth < dynamicAllowedLeaves ? "on_leave" : "absent";

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
  let flexibilityUsed = 0;

  // 1. Fetch employee early to check required hours and flexibility
  const devQuery = query(collection(db, "developers"), where("uid", "==", uid));
  const devSnap = await getDocs(devQuery);
  const employee = devSnap.empty ? null : (devSnap.docs[0].data() as any);

  // 2. Compute isLate exactly as clockIn does
  if (checkIn && employee) {
    const now = new Date(checkIn);
    const officeStart = new Date(now);
    officeStart.setHours(settings.startHour, settings.startMinute, 0, 0);
    const graceDeadline = new Date(officeStart);
    graceDeadline.setMinutes(graceDeadline.getMinutes() + (settings.graceMinutes || 0));

    const officeEnd = new Date(now);
    officeEnd.setHours(settings.endHour, settings.endMinute, 0, 0);

    const defaultWeeklyHours = employee.accessLevel === "intern" ? 30 : 40;
    const dailyHours = (employee.officeHours || defaultWeeklyHours) / 5;
    const requiredMinutes = dailyHours * 60;

    const remainingOfficeMinutes = Math.floor((officeEnd.getTime() - now.getTime()) / 60000);
    const shortBy = requiredMinutes - remainingOfficeMinutes;
    const grace = settings.graceMinutes || 0;

    let lateMinutes = 0;
    if (shortBy > grace) {
      isLate = true;
      lateMinutes = shortBy - grace;
    }

    if (isLate && employee.flexibilityHours) {
      const weekStart = new Date(now);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartIso = weekStart.toISOString().slice(0, 10);

      const q = query(collection(db, COL), where("uid", "==", uid));
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
        isLate = false;
        flexibilityUsed = lateMinutes;
      } else {
        flexibilityUsed = Math.max(0, remainingFlex);
      }
    }
  } else if (checkIn) {
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

  let finalStatus: AttendanceStatus =
    status === "present" && isLate ? "late" : status;
  let adminApprovedLeave = false;

  if (finalStatus === "absent" || finalStatus === "on_leave") {
    if (employee) {
      const monthPrefix = date.slice(0, 7);
      const start = `${monthPrefix}-01`;
      const end = `${monthPrefix}-31`;

      const attQuery = query(collection(db, COL), where("uid", "==", uid));

      const snap = await getDocs(attQuery);
      const allRecords: AttendanceRecord[] = [];
      let totalLeavesThisMonth = 0;
      snap.forEach((d) => {
        const r = d.data() as AttendanceRecord;
        allRecords.push(r);
        if (
          r.date >= start &&
          r.date <= end &&
          r.date !== date &&
          r.status === "on_leave"
        ) {
          totalLeavesThisMonth++;
        }
      });
      const allowedLeaves = calculateDynamicAllowedLeaves({
        employee,
        settings,
        targetMonthStr: monthPrefix,
        allAttendanceRecords: allRecords,
      });

      if (finalStatus === "absent") {
        if (totalLeavesThisMonth < allowedLeaves) {
          finalStatus = "on_leave";
        }
      } else if (finalStatus === "on_leave") {
        adminApprovedLeave = true;
      }
    }
  }

  await setDoc(
    doc(db, COL, id),
    {
      uid,
      employeeName,
      date,
      checkIn: checkIn ?? null,
      checkOut: checkOut ?? null,
      status: finalStatus,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      isLate,
      flexibilityUsed,
      isOvertime,
      overtimeMinutes: overtime,
      ...(adminApprovedLeave
        ? { adminApprovedLeave: true }
        : { adminApprovedLeave: deleteField() }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await logAdminAction(
    "Marked Attendance",
    `Marked attendance for ${employeeName} on ${date} as ${finalStatus}`,
  );
}

export async function updateAttendance(
  id: string,
  patch: Partial<Omit<AttendanceRecord, "id">>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  const updates = Object.keys(patch).join(", ");
  await logAdminAction(
    "Updated Attendance",
    `Updated attendance (ID: ${id}) fields: ${updates}`,
  );
}

export async function deleteAttendance(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await logAdminAction(
    "Deleted Attendance",
    `Deleted attendance record (ID: ${id})`,
  );
}

export async function autoFillAllMissingAttendance(
  settings: OfficeSettings,
): Promise<void> {
  const empSnap = await getDocs(collection(db, "developers"));
  const employees: Developer[] = [];
  empSnap.forEach((d) => {
    employees.push({ id: d.id, ...d.data() } as Developer);
  });

  for (const emp of employees) {
    if (emp.status === "inactive") continue;
    try {
      await autoFillMissingAttendance(emp, settings);
    } catch (err) {
      console.error(`Failed to auto-fill attendance for ${emp.uid || emp.id}:`, err);
    }
  }
}
