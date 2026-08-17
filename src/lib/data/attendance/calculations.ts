// Pure domain calculations and time/leave math for attendance.

import type {
  AttendanceRecord,
  DailyTask,
  Developer,
  Employee,
  OfficeSettings,
} from "@/lib/data/types";
import { resolveODHAndPenalties } from "./odh-clearing";

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
  totalAdminLeaves: number;
  totalSickLeaves: number;
  totalAbsent: number;
  totalHoursWorked: number;
  totalOvertimeMinutes: number;
  lateDaysOverThreshold: number; // late days beyond allowed threshold
  excessLeaves: number; // leaves beyond allowed quota
  deductionDays: number; // total deduction days (half-day for late + full-day for excess leave)
  overtimeDueMinutes?: number; // total ODH shortfall including weekly hours
  penaltyODHMinutes?: number; // penalty ODH from late/absences only for interns and unpaid members
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
  let totalAdminLeaves = 0;

  for (const r of records) {
    switch (r.status) {
      case "present":
        totalPresent++;
        break;
      case "late":
        totalLate++;
        break;
      case "on_leave":
        if (r.adminApprovedLeave) {
          totalAdminLeaves++;
        } else {
          totalLeaves++;
        }
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

  const empId = employee?.id || employee?.uid || (records[0] ? records[0].uid : undefined);
  for (const t of tasks) {
    const isForEmployee = !empId || t.assigneeId === empId || t.assigneeId === employee?.id || t.assigneeId === employee?.uid;
    const isForMonth = !targetMonthStr || t.date.startsWith(targetMonthStr);
    if (isForEmployee && isForMonth && t.status === "done") {
      if (t.isOvertime || t.compensatesWeeklyHours) {
        totalHoursWorked += Number(t.assignedHours) || 0;
        if (isIntern) {
          totalOvertimeMinutes += (Number(t.assignedHours) || 0) * 60;
        } else if (!t.resolvesODH && !t.compensatesWeeklyHours) {
          totalOvertimeMinutes += (Number(t.assignedHours) || 0) * 60;
        }
      }
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

  const grossLatePenalties = Math.max(
    0,
    totalLate - settings.lateThresholdDays,
  );

  const initialPenaltyMap = getDailyPenaltyMap(
    allAttendanceRecords || records,
    employee,
    settings,
    targetMonthStr,
  );
  const rawOdhMap = getWeeklyOvertimeDueMap(
    allAttendanceRecords || records,
    employee,
    settings,
    [],
    initialPenaltyMap
  );
  const clearingResult = resolveODHAndPenalties(
    allAttendanceRecords || records,
    tasks,
    employee,
    settings,
    rawOdhMap,
    initialPenaltyMap,
    targetMonthStr,
  );
  const totalWeeklyODH = Object.entries(clearingResult.odhMap)
    .filter(([date]) => !targetMonthStr || date.startsWith(targetMonthStr))
    .reduce((acc, [, m]) => acc + m, 0);
  const isPaid = Number(employee?.monthlySalary) > 0;
  const treatAsUnpaidIntern = isIntern && !isPaid;

  let unclearedLateCount = 0;
  let unclearedLeaveCount = 0;
  let unclearedAbsentCount = 0;

  Object.entries(clearingResult.penaltyMap)
    .filter(([date]) => !targetMonthStr || date.startsWith(targetMonthStr))
    .forEach(([, chips]) => {
      chips.forEach((chip) => {
        if (chip.isClearingChip) return;
        const isCleared = chips.some(
          (c) => c.isClearingChip && c.clearedPenaltyType === chip.type
        );
        if (isCleared) return;

        if (
          chip.type === "late" ||
          chip.type === "half_day" ||
          chip.type === "employee_late_deduction" ||
          chip.type === "intern_late_odh"
        ) {
          unclearedLateCount++;
        } else if (
          chip.type === "leave" ||
          chip.type === "employee_leave_deduction" ||
          chip.type === "intern_leave_odh"
        ) {
          unclearedLeaveCount++;
        } else if (
          chip.type === "absent" ||
          chip.type === "employee_absent_deduction" ||
          chip.type === "intern_absent_odh"
        ) {
          unclearedAbsentCount++;
        }
      });
    });

  const unclearedInternPenaltyMinutes = Object.entries(clearingResult.penaltyMap)
    .filter(([date]) => !targetMonthStr || date.startsWith(targetMonthStr))
    .reduce((acc, [, chips]) => {
      return (
        acc +
        chips
          .filter((c) => {
            if (c.isClearingChip || !c.minutes) return false;
            const isCleared = chips.some(
              (cl) => cl.isClearingChip && cl.clearedPenaltyType === c.type
            );
            return !isCleared;
          })
          .reduce((s, c) => s + (c.minutes || 0), 0)
      );
    }, 0);

  if (treatAsUnpaidIntern) {
    return {
      totalPresent,
      totalLate,
      totalLeaves,
      totalAdminLeaves,
      totalSickLeaves,
      totalAbsent: unclearedAbsentCount,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalOvertimeMinutes: totalOvertimeMinutes,
      lateDaysOverThreshold: 0,
      excessLeaves: 0,
      deductionDays: 0,
      overtimeDueMinutes: totalWeeklyODH + unclearedInternPenaltyMinutes,
      penaltyODHMinutes: unclearedInternPenaltyMinutes,
    };
  } else {
    const lateDaysOverThreshold = grossLatePenalties;

    // Each excess late day = 0.5 day deduction; each excess leave = 1 day deduction. Each absent day = 1 day deduction.
    const rawDeductionDays =
      lateDaysOverThreshold * 0.5 + excessLeaves + totalAbsent;
    const deductionDays = Math.max(
      0,
      rawDeductionDays - clearingResult.clearedDeductionDays,
    );

    return {
      totalPresent,
      totalLate,
      totalLeaves,
      totalAdminLeaves,
      totalSickLeaves,
      totalAbsent: unclearedAbsentCount,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalOvertimeMinutes: totalOvertimeMinutes,
      lateDaysOverThreshold: unclearedLateCount,
      excessLeaves: unclearedLeaveCount,
      deductionDays,
      overtimeDueMinutes: totalWeeklyODH,
      penaltyODHMinutes: unclearedInternPenaltyMinutes,
    };
  }
}

export function formatODH(minutes: number): string {
  if (minutes < 60) return `${minutes}m ODH`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m ODH` : `${hrs}h ODH`;
}

export function getWeeklyOvertimeDueMap(
  records: AttendanceRecord[],
  employee: any,
  settings: OfficeSettings,
  tasks: DailyTask[] = [],
  penaltyMap?: Record<string, DatePenaltyChip[]>
): Record<string, number> {
  const odhMap: Record<string, number> = {};
  if (!records || records.length === 0) return odhMap;

  const empId = employee?.id || employee?.uid;
  const filteredRecords = empId
    ? records.filter((r) => r.uid === empId || r.uid === employee?.uid || r.uid === employee?.id)
    : records;

  // Group records by Monday of their week
  const weekGroups: Record<string, AttendanceRecord[]> = {};
  for (const r of filteredRecords) {
    if (!r.date) continue;
    const d = new Date(r.date + "T12:00:00");
    const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diffToMonday);
    const weekKey = getLocalISODate(mon);
    if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
    weekGroups[weekKey].push(r);
  }

  const todayStr = getLocalISODate(new Date());
  const now = new Date();
  const closingTimeToday = new Date(now);
  closingTimeToday.setHours(settings.endHour || 18, settings.endMinute || 0, 0, 0);

  const defaultWeeklyHours =
    Number(employee?.officeHours) || (employee?.accessLevel === "intern" ? 30 : 40);
  const dailyRequiredHours = defaultWeeklyHours / 5;
  const dailyRequiredMinutes = Math.round(dailyRequiredHours * 60);

  for (const [weekKey, weekRecords] of Object.entries(weekGroups)) {
    // Determine Friday of this week
    const mon = new Date(weekKey + "T12:00:00");
    const fri = new Date(mon);
    fri.setDate(fri.getDate() + 4);
    const friStr = getLocalISODate(fri);

    // Check if the week should be evaluated:
    // 1. Friday is strictly in the past (friStr < todayStr), OR
    // 2. Today is Friday or later in the week (todayStr >= friStr) AND:
    //    a) there is a checkOut on Friday, OR
    //    b) status on Friday is absent/on_leave/sick_leave, OR
    //    c) today is Friday and now is past office close time, OR
    //    d) today is Saturday/Sunday (todayStr > friStr)
    const friRec = weekRecords.find((r) => r.date === friStr);
    const isFriClosed =
      friStr < todayStr ||
      (friRec &&
        (friRec.checkOut !== null ||
          friRec.status === "absent" ||
          friRec.status === "on_leave" ||
          friRec.status === "sick_leave")) ||
      (todayStr === friStr && now >= closingTimeToday);

    if (!isFriClosed) {
      continue;
    }

    // Calculate required minutes for this week (excluding on_leave / sick_leave days)
    let leaveDaysCount = 0;
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(mon);
      dayDate.setDate(dayDate.getDate() + i);
      const dayStr = getLocalISODate(dayDate);
      if (employee?.startDate && dayStr < employee.startDate) {
        leaveDaysCount++;
        continue;
      }
      const rec = weekRecords.find((r) => r.date === dayStr);
      if (
        rec &&
        (rec.status === "on_leave" ||
          rec.status === "sick_leave" ||
          rec.status === "absent")
      ) {
        leaveDaysCount++;
      }
    }
    const requiredWeekMinutes = Math.max(
      0,
      (5 - leaveDaysCount) * dailyRequiredMinutes,
    );

    // Sum total hours worked across the entire week
    let totalWeekWorkedMinutes = 0;
    const dayWorkedMap: Record<string, number> = {};

    for (const r of weekRecords) {
      let hw = r.hoursWorked || 0;
      if (hw === 0 && r.checkIn) {
        const outTime = r.checkOut ? new Date(r.checkOut) : new Date();
        hw = Math.max(
          0,
          (outTime.getTime() - new Date(r.checkIn).getTime()) / 3_600_000,
        );
      }
      const empId = employee?.id || employee?.uid || r.uid;
      const dayTasks = tasks.filter(
        (t) =>
          t.date === r.date &&
          (t.assigneeId === empId || t.assigneeId === r.uid) &&
          t.status === "done" &&
          (t.isOvertime || t.compensatesWeeklyHours),
      );
      const taskMins = dayTasks.reduce(
        (acc, t) => acc + Math.round((Number(t.assignedHours) || 0) * 60),
        0,
      );

      const dayMins = Math.round(hw * 60) + taskMins;
      dayWorkedMap[r.date] = dayMins;
      totalWeekWorkedMinutes += dayMins;
    }

    let weeklyOvertimeDueMinutes = Math.max(
      0,
      requiredWeekMinutes - totalWeekWorkedMinutes,
    );

    // 1. Check flexibility: if employee has flexibilityHours allowed, deduct unused weekly flexibility from ODH first!
    const allowedFlexMinutes = (Number(employee?.flexibilityHours) || 0) * 60;
    if (weeklyOvertimeDueMinutes > 0 && allowedFlexMinutes > 0) {
      const usedFlexMinutesInWeek = weekRecords.reduce(
        (acc, r) => acc + (Number(r.flexibilityUsed) || 0),
        0,
      );
      const remainingFlexMinutes = Math.max(
        0,
        allowedFlexMinutes - usedFlexMinutesInWeek,
      );
      if (remainingFlexMinutes > 0) {
        const flexCovered = Math.min(
          weeklyOvertimeDueMinutes,
          remainingFlexMinutes,
        );
        weeklyOvertimeDueMinutes -= flexCovered;
        
        if (penaltyMap && flexCovered > 0) {
          const sortedWeekRecords = [...weekRecords].sort((a, b) => b.date.localeCompare(a.date));
          if (sortedWeekRecords.length > 0) {
            const lastDate = sortedWeekRecords[0].date;
            if (!penaltyMap[lastDate]) penaltyMap[lastDate] = [];
            const hrs = Math.floor(flexCovered / 60);
            const mins = flexCovered % 60;
            const timeStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h 0m`;
            
            penaltyMap[lastDate].push({
              type: "flex_used",
              label: `+${timeStr} Flex Used`,
              tooltip: `Remaining weekly flexibility (${timeStr}) used to cover weekly ODH`,
              color: "#3b82f6",
              bgcolor: "#3b82f622",
            });
          }
        }
      }
    }

    // 2. Distribute any remaining ODH across short days
    if (weeklyOvertimeDueMinutes > 0) {
      const shortDays: { date: string; shortfall: number }[] = [];
      for (const r of weekRecords) {
        if (
          r.status === "on_leave" ||
          r.status === "sick_leave" ||
          r.status === "absent"
        )
          continue;
        const worked = dayWorkedMap[r.date] || 0;
        if (worked < dailyRequiredMinutes) {
          shortDays.push({
            date: r.date,
            shortfall: dailyRequiredMinutes - worked,
          });
        }
      }

      shortDays.sort((a, b) => a.date.localeCompare(b.date));

      let remainingODH = weeklyOvertimeDueMinutes;
      for (const sd of shortDays) {
        if (remainingODH <= 0) break;
        const alloc = Math.min(remainingODH, sd.shortfall);
        if (alloc > 0) {
          odhMap[sd.date] = (odhMap[sd.date] || 0) + alloc;
          remainingODH -= alloc;
        }
      }
    }
  }

  return odhMap;
}

export interface DatePenaltyChip {
  type: string;
  label: string;
  tooltip: string;
  color: string;
  bgcolor: string;
  isClearingChip?: boolean;
  clearedPenaltyType?: string;
  minutes?: number;
}

export function getDailyPenaltyMap(
  records: AttendanceRecord[],
  employee: any,
  settings: OfficeSettings,
  targetMonthStr?: string,
): Record<string, DatePenaltyChip[]> {
  const penaltyMap: Record<string, DatePenaltyChip[]> = {};
  if (!records || records.length === 0) return penaltyMap;

  const empId = employee?.id || employee?.uid;
  const filteredRecords = empId
    ? records.filter((r) => r.uid === empId || r.uid === employee?.uid || r.uid === employee?.id)
    : records;

  // Group records by month YYYY-MM
  const monthGroups: Record<string, AttendanceRecord[]> = {};
  for (const r of filteredRecords) {
    if (!r.date) continue;
    const mo = r.date.slice(0, 7);
    if (targetMonthStr && !r.date.startsWith(targetMonthStr)) continue;
    if (!monthGroups[mo]) monthGroups[mo] = [];
    monthGroups[mo].push(r);
  }

  const isIntern = employee?.accessLevel === "intern";
  const isPaid = Number(employee?.monthlySalary) > 0;
  const treatAsUnpaidIntern = isIntern && !isPaid;
  const dailyHours = (Number(employee?.officeHours) || (isIntern ? 30 : 40)) / 5;
  const halfDayHours = dailyHours / 2;
  const lateThreshold = settings?.lateThresholdDays ?? 3;

  for (const [mo, moRecords] of Object.entries(monthGroups)) {
    // Sort chronologically by date
    moRecords.sort((a, b) => a.date.localeCompare(b.date));

    let lateCount = 0;
    let leaveCount = 0;

    const allowedLeaves = calculateDynamicAllowedLeaves({
      employee,
      settings,
      targetMonthStr: mo,
      allAttendanceRecords: records,
    });

    for (const r of moRecords) {
      if (!penaltyMap[r.date]) penaltyMap[r.date] = [];

      // 1. Late Penalty (Exceeding monthly late threshold)
      if (r.isLate) {
        lateCount++;
        if (lateCount > lateThreshold) {
          if (treatAsUnpaidIntern) {
            penaltyMap[r.date].push({
              type: "intern_late_odh",
              label: `+${halfDayHours}h Late ODH`,
              tooltip: `Late Penalty Overtime Due (+${halfDayHours}h half-day office hours added for exceeding monthly lates threshold)`,
              color: "#a855f7",     // Purple
              bgcolor: "#a855f722",
              minutes: Math.round(halfDayHours * 60),
            });
          } else {
            penaltyMap[r.date].push({
              type: "employee_late_deduction",
              label: "-0.5d Salary",
              tooltip: "Salary Deduction Penalty (0.5 day salary deduction for exceeding monthly lates threshold)",
              color: "#f43f5e",     // Rose/crimson
              bgcolor: "#f43f5e22",
            });
          }
        }
      }

      // 2. Excess Leave Penalty (Exceeding allowed leaves)
      if (r.status === "on_leave" && !r.adminApprovedLeave) {
        leaveCount++;
        if (leaveCount > allowedLeaves) {
          if (treatAsUnpaidIntern) {
            penaltyMap[r.date].push({
              type: "intern_leave_odh",
              label: `+${dailyHours}h Leave ODH`,
              tooltip: `Leave Penalty Overtime Due (+${dailyHours}h office hours for unapproved excess leave)`,
              color: "#a855f7",
              bgcolor: "#a855f722",
              minutes: Math.round(dailyHours * 60),
            });
          } else {
            penaltyMap[r.date].push({
              type: "employee_leave_deduction",
              label: "-1d Salary",
              tooltip: "Salary Deduction Penalty (1.0 day salary deduction for unapproved excess leave)",
              color: "#f43f5e",
              bgcolor: "#f43f5e22",
            });
          }
        }
      }

      // 3. Unexcused Absence Penalty
      if (r.status === "absent") {
        if (treatAsUnpaidIntern) {
          penaltyMap[r.date].push({
            type: "intern_absent_odh",
            label: `+${dailyHours}h Absent ODH`,
            tooltip: `Absence Penalty Overtime Due (+${dailyHours}h office hours for unexcused absence)`,
            color: "#a855f7",
            bgcolor: "#a855f722",
            minutes: Math.round(dailyHours * 60),
          });
        } else {
          penaltyMap[r.date].push({
            type: "employee_absent_deduction",
            label: "-1d Salary",
            tooltip: "Salary Deduction Penalty (1.0 day salary deduction for unexcused absence)",
            color: "#f43f5e",
            bgcolor: "#f43f5e22",
          });
        }
      }
    }
  }

  return penaltyMap;
}

