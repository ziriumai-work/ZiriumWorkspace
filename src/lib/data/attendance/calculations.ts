// Pure domain calculations and time/leave math for attendance.

import type {
  AttendanceRecord,
  DailyTask,
  Developer,
  Employee,
  OfficeSettings,
} from "@/lib/data/types";

export function isCheckInLate(
  checkInIso: string,
  settings: OfficeSettings,
): boolean {
  const checkIn = new Date(checkInIso);
  const deadline = new Date(checkIn);
  deadline.setHours(settings.startHour, settings.startMinute, 0, 0);
  deadline.setMinutes(deadline.getMinutes() + settings.graceMinutes);
  return checkIn > deadline;
}

export function calcOvertimeMinutes(
  checkOutIso: string,
  settings: OfficeSettings,
): number {
  const checkOut = new Date(checkOutIso);
  const endTime = new Date(checkOut);
  endTime.setHours(settings.endHour, settings.endMinute, 0, 0);
  const diff = (checkOut.getTime() - endTime.getTime()) / 60_000;
  return Math.max(0, Math.round(diff));
}

export function getLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWorkingDaysInWeekFromStart(weekStartIso: string, startDate?: string | null): number {
  if (!startDate) return 5;
  const parts = weekStartIso.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  let workingDays = 0;
  for (let i = 0; i < 5; i++) {
    const d = new Date(year, month - 1, day + i);
    const dayIso = getLocalISODate(d);
    if (dayIso >= startDate) {
      workingDays++;
    }
  }
  return workingDays;
}

export function getEmployeeStartYearMonth(
  employee: Developer | Employee | any,
): string {
  if (
    employee?.startDate &&
    typeof employee.startDate === "string" &&
    employee.startDate.length >= 7
  ) {
    return employee.startDate.slice(0, 7);
  }
  if (employee?.createdAt) {
    const dt =
      typeof employee.createdAt.toDate === "function"
        ? employee.createdAt.toDate()
        : new Date(employee.createdAt);
    if (!isNaN(dt.getTime())) {
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, "0");
      return `${yr}-${mo}`;
    }
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface DynamicLeaveAllowance {
  baseAllowance: number;
  rolloverLeaves: number;
  totalAllowedLeaves: number;
  startMonthStr: string;
}

export function getDynamicLeaveAllowance({
  employee,
  settings,
  targetMonthStr,
  allAttendanceRecords,
}: {
  employee: Developer | Employee | any;
  settings: OfficeSettings;
  targetMonthStr: string; // "YYYY-MM"
  allAttendanceRecords?: AttendanceRecord[];
}): DynamicLeaveAllowance {
  const baseAllowance =
    employee?.accessLevel === "intern"
      ? settings.internLeavesPerMonth
      : settings.employeeLeavesPerMonth;

  const startMonthStr = getEmployeeStartYearMonth(employee);

  if (
    !targetMonthStr ||
    !allAttendanceRecords ||
    targetMonthStr <= startMonthStr
  ) {
    return {
      baseAllowance,
      rolloverLeaves: 0,
      totalAllowedLeaves: baseAllowance,
      startMonthStr,
    };
  }

  let currentRollover = 0;
  const curr = new Date(`${startMonthStr}-01T00:00:00`);
  const end = new Date(`${targetMonthStr}-01T00:00:00`);

  while (curr < end) {
    const yr = curr.getFullYear();
    const mo = String(curr.getMonth() + 1).padStart(2, "0");
    const monthPrefix = `${yr}-${mo}`;

    const monthAllowed = baseAllowance + currentRollover;

    let usedLeaves = 0;
    allAttendanceRecords.forEach((r) => {
      if (
        r.uid === employee.uid &&
        r.date.startsWith(monthPrefix) &&
        r.status === "on_leave"
      ) {
        usedLeaves++;
      }
    });

    currentRollover = Math.max(0, monthAllowed - usedLeaves);
    curr.setMonth(curr.getMonth() + 1);
  }

  return {
    baseAllowance,
    rolloverLeaves: currentRollover,
    totalAllowedLeaves: baseAllowance + currentRollover,
    startMonthStr,
  };
}

export function calculateDynamicAllowedLeaves({
  employee,
  settings,
  targetMonthStr,
  allAttendanceRecords,
}: {
  employee: Developer | Employee | any;
  settings: OfficeSettings;
  targetMonthStr: string; // "YYYY-MM"
  allAttendanceRecords?: AttendanceRecord[];
}): number {
  return getDynamicLeaveAllowance({
    employee,
    settings,
    targetMonthStr,
    allAttendanceRecords,
  }).totalAllowedLeaves;
}

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
  employee?: any,
  allAttendanceRecords?: AttendanceRecord[],
  targetMonthStr?: string,
): MonthlySummary {
  let totalPresent = 0;
  let totalLate = 0;
  let totalLeaves = 0;
  let totalSickLeaves = 0;
  let totalAbsent = 0;
  let totalHoursWorked = 0;
  let totalOvertimeMinutes = 0;
  let totalAdminApprovedLeaves = 0;

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
        if (r.adminApprovedLeave) totalAdminApprovedLeaves++;
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
      hw = Math.max(
        0,
        (outTime.getTime() - new Date(r.checkIn).getTime()) / 3_600_000,
      );
      ot = r.checkOut ? calcOvertimeMinutes(r.checkOut, settings) : 0;
    }

    totalHoursWorked += hw;
    totalOvertimeMinutes += ot;
  }

  for (const t of tasks) {
    if (t.status === "done" && (t.isOvertime || t.compensatesWeeklyHours)) {
      totalHoursWorked += Number(t.assignedHours) || 0;
      totalOvertimeMinutes += (Number(t.assignedHours) || 0) * 60;
    }
  }

  const allowedLeaves =
    employee && allAttendanceRecords && targetMonthStr
      ? calculateDynamicAllowedLeaves({
          employee,
          settings,
          targetMonthStr,
          allAttendanceRecords,
        })
      : isIntern
        ? settings.internLeavesPerMonth
        : settings.employeeLeavesPerMonth;

  const excessLeaves = Math.max(0, totalLeaves - allowedLeaves);
  const excessLeavesToPenalize = Math.max(
    0,
    excessLeaves - totalAdminApprovedLeaves,
  );

  const grossLatePenalties = Math.max(
    0,
    totalLate - settings.lateThresholdDays,
  );

  if (isIntern) {
    const dailyHours = (employee?.officeHours || 30) / 5;
    const dailyMinutes = dailyHours * 60;

    // Total missing minutes from absentees and excess leaves
    const missingMinutesFromAbsences =
      (totalAbsent + excessLeavesToPenalize) * dailyMinutes;
    // Missing minutes from late days over threshold
    const missingMinutesFromLates = grossLatePenalties * (dailyMinutes / 2);

    const totalPenaltyMinutes =
      missingMinutesFromAbsences + missingMinutesFromLates;

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
    const dailyMinutes = ((employee?.officeHours || 40) / 5) * 60;
    const overtimeOffsetDays = Math.floor(
      totalOvertimeMinutes / dailyMinutes,
    );
    const lateDaysOverThreshold = Math.max(
      0,
      grossLatePenalties - overtimeOffsetDays,
    );

    // Each excess late day = 0.5 day deduction; each excess leave = 1 day deduction. Each absent day = 1 day deduction.
    const deductionDays =
      lateDaysOverThreshold * 0.5 + excessLeavesToPenalize + totalAbsent;

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
