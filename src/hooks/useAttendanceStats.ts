import { useMemo } from "react";
import { computeMonthlySummary, getDynamicLeaveAllowance } from "@/lib/data/attendance";
import { getWorkingDaysInWeekFromStart, getLocalISODate } from "@/lib/data/attendance/calculations";
import { type AttendanceRecord, type Employee, type OfficeSettings, type DailyTask } from "@/lib/data/types";
import { User } from "firebase/auth";

interface UseAttendanceStatsProps {
  records: AttendanceRecord[];
  tasks: DailyTask[];
  employees: Employee[];
  settings: OfficeSettings;
  user: User | null;
  isAdmin: boolean;
  employee: Employee | null;
  filterUid: string;
  filterDepartment: string;
  filterRole: string;
  summaryMonth: string;
}

export function useAttendanceStats({
  records,
  tasks,
  employees,
  settings,
  user,
  isAdmin,
  employee,
  filterUid,
  filterDepartment,
  filterRole,
  summaryMonth,
}: UseAttendanceStatsProps) {
  // Filtered view scoped to summaryMonth.
  const displayed = useMemo(() => {
    const target = summaryMonth; // "yyyy-mm"
    let result = records.filter(r => r.date.startsWith(target));
    if (!isAdmin) {
      if (user) result = result.filter((r) => r.uid === user.uid);
    } else {
      if (filterUid !== "all") {
        result = result.filter((r) => r.uid === filterUid);
      }
      if (filterDepartment !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.department === filterDepartment;
        });
      }
      if (filterRole !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.accessLevel === filterRole;
        });
      }
    }
    return result;
  }, [records, summaryMonth, filterUid, filterDepartment, filterRole, isAdmin, user, employees]);

  const monthRecords = useMemo(() => {
    const target = summaryMonth; // "yyyy-mm"
    let result = records.filter(r => r.date.startsWith(target));
    if (!isAdmin) {
      if (user) result = result.filter((r) => r.uid === user.uid);
    } else {
      if (filterUid !== "all") {
        result = result.filter((r) => r.uid === filterUid);
      }
      if (filterDepartment !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.department === filterDepartment;
        });
      }
      if (filterRole !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.accessLevel === filterRole;
        });
      }
    }
    return result;
  }, [records, summaryMonth, filterUid, filterDepartment, filterRole, isAdmin, user, employees]);

  const monthTasks = useMemo(() => {
    const target = summaryMonth; // "yyyy-mm"
    let result = tasks.filter(t => t.date.startsWith(target));
    if (!isAdmin) {
      if (employee) result = result.filter((t) => t.assigneeId === employee.id);
    } else {
      if (filterUid !== "all") {
        const selectedEmp = employees.find(e => e.uid === filterUid);
        if (selectedEmp) {
          result = result.filter((t) => t.assigneeId === selectedEmp.id);
        } else {
          result = []; // fallback if not found
        }
      }
      if (filterDepartment !== "all") {
        result = result.filter((t) => {
          const emp = employees.find(e => e.id === t.assigneeId);
          return emp?.department === filterDepartment;
        });
      }
      if (filterRole !== "all") {
        result = result.filter((t) => {
          const emp = employees.find(e => e.id === t.assigneeId);
          return emp?.accessLevel === filterRole;
        });
      }
    }
    return result;
  }, [tasks, summaryMonth, filterUid, filterDepartment, filterRole, isAdmin, employee, employees]);

  const targetEmployee = useMemo(() => {
    if (isAdmin && filterUid !== "all") {
      return employees.find(e => e.uid === filterUid) || employee;
    }
    return employee;
  }, [isAdmin, filterUid, employees, employee]);

  const isTargetIntern = targetEmployee?.accessLevel === "intern";

  const summary = useMemo(() => {
    if (isAdmin && filterUid === "all") {
      const uids = new Set(monthRecords.map(r => r.uid));
      const matchedEmployees = employees.filter(emp => {
        if (filterDepartment !== "all" && emp.department !== filterDepartment) return false;
        if (filterRole !== "all" && emp.accessLevel !== filterRole) return false;
        return true;
      });
      matchedEmployees.forEach(e => {
        if (e.uid) uids.add(e.uid);
      });

      const aggregated = {
        totalPresent: 0,
        totalLate: 0,
        totalLeaves: 0,
        totalSickLeaves: 0,
        totalAbsent: 0,
        totalHoursWorked: 0,
        totalOvertimeMinutes: 0,
        lateDaysOverThreshold: 0,
        excessLeaves: 0,
        deductionDays: 0,
        overtimeDueMinutes: 0,
      };

      for (const uid of uids) {
        if (!uid) continue;
        const emp = employees.find(e => e.uid === uid);
        if (!emp) continue;
        
        const empRecords = monthRecords.filter(r => r.uid === uid);
        const empTasks = monthTasks.filter(t => t.assigneeId === emp.id);
        
        const s = computeMonthlySummary(empRecords, empTasks, settings, emp.accessLevel === "intern", emp, records, summaryMonth);
        
        aggregated.totalPresent += s.totalPresent;
        aggregated.totalLate += s.totalLate;
        aggregated.totalLeaves += s.totalLeaves;
        aggregated.totalSickLeaves += s.totalSickLeaves;
        aggregated.totalAbsent += s.totalAbsent;
        aggregated.totalHoursWorked += s.totalHoursWorked;
        aggregated.totalOvertimeMinutes += s.totalOvertimeMinutes;
        aggregated.lateDaysOverThreshold += s.lateDaysOverThreshold;
        aggregated.excessLeaves += s.excessLeaves;
        aggregated.deductionDays += s.deductionDays;
        aggregated.overtimeDueMinutes += (s.overtimeDueMinutes || 0);
      }
      
      aggregated.totalHoursWorked = Math.round(aggregated.totalHoursWorked * 100) / 100;
      
      return aggregated;
    } else {
      return computeMonthlySummary(
        monthRecords,
        monthTasks,
        settings,
        isTargetIntern,
        targetEmployee || undefined,
        records,
        summaryMonth
      );
    }
  }, [monthRecords, monthTasks, settings, isTargetIntern, targetEmployee, isAdmin, filterUid, employees, filterDepartment, filterRole, records, summaryMonth]);

  // Non-Admin Statistics
  const myStats = useMemo(() => {
    if (isAdmin || !employee) return null;

    const now = new Date();
    const todayStr = getLocalISODate(now);
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(12, 0, 0, 0); // avoid UTC midnight timezone rollback!
    const weekStartIso = getLocalISODate(weekStart);

    const monthPrefix = todayStr.slice(0, 7); // "YYYY-MM"

    // 1. Weekly Hours
    let weeklyHoursWorked = 0;
    let daysOnLeaveThisWeek = 0;
    records.forEach(r => {
      if (r.date >= weekStartIso && r.date <= todayStr && r.uid === user?.uid) {
        weeklyHoursWorked += r.hoursWorked;
        if (r.status === "on_leave" || r.status === "sick_leave" || r.status === "absent") daysOnLeaveThisWeek++;
      }
    });

    let weeklyCompensatedHours = 0;
    tasks.forEach(t => {
      if (t.date >= weekStartIso && t.date <= todayStr && t.status === "done" && t.compensatesWeeklyHours) {
        weeklyCompensatedHours += (t.assignedHours || 0);
      }
    });

    const totalWeeklyHours = weeklyHoursWorked + weeklyCompensatedHours;
    const defaultWeeklyHours = employee.accessLevel === "intern" ? 30 : 40;
    const fullWeekHours = employee.officeHours || defaultWeeklyHours;
    const dailyHours = fullWeekHours / 5;
    const workingDaysThisWeek = getWorkingDaysInWeekFromStart(weekStartIso, employee.startDate);
    const baseRequiredHours = workingDaysThisWeek * dailyHours;
    const requiredHours = Math.max(0, baseRequiredHours - (daysOnLeaveThisWeek * dailyHours));
    const remainingHours = Math.max(0, requiredHours - totalWeeklyHours);

    // 2. Flexibility
    let flexibilityUsed = 0;
    records.forEach(r => {
      if (r.date >= weekStartIso && r.date <= todayStr && r.uid === user?.uid) {
        flexibilityUsed += (r.flexibilityUsed || 0);
      }
    });
    
    const allowedFlex = (employee.flexibilityHours || 0) * 60;
    const flexRemaining = allowedFlex - flexibilityUsed; 

    // 3. Lates & Leaves (Month)
    let monthlyLates = 0;
    let monthlyLeaves = 0;
    let monthlySickLeaves = 0;
    records.forEach(r => {
      if (r.date.startsWith(monthPrefix) && r.uid === user?.uid) {
        if (r.isLate) monthlyLates++;
        if (r.status === "on_leave") monthlyLeaves++;
        if (r.status === "sick_leave") monthlySickLeaves++;
      }
    });

    const latesAllowed = settings.lateThresholdDays;
    const leaveAllowanceDetails = employee
      ? getDynamicLeaveAllowance({
          employee,
          settings,
          targetMonthStr: summaryMonth,
          allAttendanceRecords: records,
        })
      : {
          baseAllowance: settings.employeeLeavesPerMonth,
          rolloverLeaves: 0,
          totalAllowedLeaves: settings.employeeLeavesPerMonth,
          startMonthStr: summaryMonth,
        };
    const leavesAllowed = leaveAllowanceDetails.totalAllowedLeaves;
    const rolloverLeaves = leaveAllowanceDetails.rolloverLeaves;

    const isPenaltyActive = monthlyLates > latesAllowed && remainingHours > 0 && flexRemaining < 0;

    return {
      totalWeeklyHours,
      requiredHours,
      remainingHours,
      flexRemaining,
      allowedFlex,
      latesAllowed,
      leavesAllowed,
      rolloverLeaves,
      monthlyLates,
      monthlyLeaves,
      monthlySickLeaves,
      isPenaltyActive,
    };
  }, [isAdmin, employee, records, tasks, settings, user, summaryMonth]);

  return { displayed, monthRecords, monthTasks, summary, myStats, targetEmployee, isTargetIntern };
}
