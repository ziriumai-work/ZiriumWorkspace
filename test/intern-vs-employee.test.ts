import { describe, it, expect } from "./test-runner";
import { computeMonthlySummary, getDailyPenaltyMap } from "../src/lib/data/attendance/calculations";
import { type AttendanceRecord, type OfficeSettings } from "../src/lib/data/types";

const settings: OfficeSettings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1,
};

describe("Intern vs Employee Monthly Summary & Penalty Math", () => {
  it("should calculate Intern (6 hours/day = 30 hours/week) penalties as Overtime Due with 0 deductionDays", () => {
    const mockRecords = [
      { id: "1", uid: "int1", date: "2026-07-01", status: "late", isLate: true, hoursWorked: 6 },
      { id: "2", uid: "int1", date: "2026-07-02", status: "late", isLate: true, hoursWorked: 6 },
      { id: "3", uid: "int1", date: "2026-07-03", status: "late", isLate: true, hoursWorked: 6 },
      { id: "4", uid: "int1", date: "2026-07-04", status: "late", isLate: true, hoursWorked: 6 }, // 4th late day (1 over threshold)
      { id: "5", uid: "int1", date: "2026-07-05", status: "late", isLate: true, hoursWorked: 6 }, // 5th late day (2 over threshold)
    ] as unknown as AttendanceRecord[];

    const internSummary = computeMonthlySummary(mockRecords, [], settings, true, {
      accessLevel: "intern",
      officeHours: 30,
    });

    expect(internSummary.totalLate).toBe(5);
    // Interns have 0 salary deduction days
    expect(internSummary.deductionDays).toBe(0);
    // Each excess late day (2 days) = half daily minutes (6h * 60 / 2 = 180 min). 2 * 180 = 360 min Overtime Due
    expect(internSummary.overtimeDueMinutes).toBe(360);
  });

  it("should calculate Employee (8 hours/day = 40 hours/week) penalties as Salary Deduction Days", () => {
    const mockRecords = [
      { id: "1", uid: "emp1", date: "2026-07-01", status: "late", isLate: true, hoursWorked: 8 },
      { id: "2", uid: "emp1", date: "2026-07-02", status: "late", isLate: true, hoursWorked: 8 },
      { id: "3", uid: "emp1", date: "2026-07-03", status: "late", isLate: true, hoursWorked: 8 },
      { id: "4", uid: "emp1", date: "2026-07-04", status: "late", isLate: true, hoursWorked: 8 }, // 4th late day (1 over threshold)
      { id: "5", uid: "emp1", date: "2026-07-05", status: "late", isLate: true, hoursWorked: 8 }, // 5th late day (2 over threshold)
    ] as unknown as AttendanceRecord[];

    const empSummary = computeMonthlySummary(mockRecords, [], settings, false, {
      accessLevel: "member",
      officeHours: 40,
    });

    expect(empSummary.totalLate).toBe(5);
    // Each excess late day (2 days) = 0.5 salary deduction days -> 2 * 0.5 = 1.0 deduction day
    expect(empSummary.deductionDays).toBe(1);
    expect(empSummary.lateDaysOverThreshold).toBe(2);
  });

  it("should mark unworked/short weekly hours as Overtime Due (ODH) at Friday end of week for both Employees and Interns", () => {
    // Suppose week Monday 2026-07-20 to Friday 2026-07-24 (past week so Friday is evaluated)
    // Employee required = 40h/week (8h/day).
    // Mon: 6 hours (2 hours short), Tue: 8 hours (0), Wed: 7 hours (1 hour short), Thu: on_leave (excluded), Fri: 8 hours (0).
    // Required week hours for 4 working days = 32 hours.
    // Total worked = 6 + 8 + 7 + 8 = 29 hours.
    // Shortfall = 32 - 29 = 3 hours (180 minutes).
    const mockRecords = [
      { id: "1", uid: "emp1", date: "2026-07-20", status: "present", hoursWorked: 6 },
      { id: "2", uid: "emp1", date: "2026-07-21", status: "present", hoursWorked: 8 },
      { id: "3", uid: "emp1", date: "2026-07-22", status: "present", hoursWorked: 7 },
      { id: "4", uid: "emp1", date: "2026-07-23", status: "on_leave", hoursWorked: 0 },
      { id: "5", uid: "emp1", date: "2026-07-24", status: "present", hoursWorked: 8 },
    ] as unknown as AttendanceRecord[];

    const empSummary = computeMonthlySummary(mockRecords, [], settings, false, {
      accessLevel: "member",
      officeHours: 40,
    });

    expect(empSummary.overtimeDueMinutes).toBe(180);
  });

  it("should generate date-specific Late ODH chips for Interns and Salary Deduction chips for Employees when exceeding late threshold", () => {
    const mockRecords = [
      { id: "1", uid: "u1", date: "2026-07-01", status: "present", isLate: true },
      { id: "2", uid: "u1", date: "2026-07-02", status: "present", isLate: true },
      { id: "3", uid: "u1", date: "2026-07-03", status: "present", isLate: true }, // 3rd late = threshold (no penalty)
      { id: "4", uid: "u1", date: "2026-07-04", status: "present", isLate: true }, // 4th late = PENALTY!
      { id: "5", uid: "u1", date: "2026-07-05", status: "present", isLate: true }, // 5th late = PENALTY!
    ] as unknown as AttendanceRecord[];

    const internPenalties = getDailyPenaltyMap(mockRecords, { accessLevel: "intern", officeHours: 30 }, settings);
    expect(internPenalties["2026-07-03"]?.length || 0).toBe(0);
    expect(internPenalties["2026-07-04"]?.[0]?.label).toBe("+3h Late ODH");
    expect(internPenalties["2026-07-04"]?.[0]?.color).toBe("#a855f7"); // Purple

    const employeePenalties = getDailyPenaltyMap(mockRecords, { accessLevel: "member", officeHours: 40 }, settings);
    expect(employeePenalties["2026-07-03"]?.length || 0).toBe(0);
    expect(employeePenalties["2026-07-04"]?.[0]?.label).toBe("-0.5d Salary");
    expect(employeePenalties["2026-07-04"]?.[0]?.color).toBe("#f43f5e"); // Crimson/Rose

    const paidInternPenalties = getDailyPenaltyMap(mockRecords, { accessLevel: "intern", officeHours: 30, monthlySalary: 45000 }, settings);
    expect(paidInternPenalties["2026-07-04"]?.[0]?.label).toBe("-0.5d Salary");
    expect(paidInternPenalties["2026-07-04"]?.[0]?.color).toBe("#f43f5e"); // Crimson/Rose
  });

  it("should treat paid interns identically to employees for salary deductions and apply overtimeOffsetDays when compensatory tasks are worked", () => {
    const mockRecords = [
      { id: "1", uid: "u1", date: "2026-07-01", status: "late", isLate: true, hoursWorked: 6 },
      { id: "2", uid: "u1", date: "2026-07-02", status: "late", isLate: true, hoursWorked: 6 },
      { id: "3", uid: "u1", date: "2026-07-03", status: "late", isLate: true, hoursWorked: 6 },
      { id: "4", uid: "u1", date: "2026-07-04", status: "late", isLate: true, hoursWorked: 6 }, // 4th late = 1 over threshold (= 0.5d penalty)
      { id: "5", uid: "u1", date: "2026-07-05", status: "late", isLate: true, hoursWorked: 6 }, // 5th late = 2 over threshold (= 1.0d penalty)
    ] as unknown as AttendanceRecord[];

    // Unpaid intern: 0 deductionDays
    const unpaidSummary = computeMonthlySummary(mockRecords, [], settings, true, {
      accessLevel: "intern",
      officeHours: 30,
      monthlySalary: 0,
    });
    expect(unpaidSummary.deductionDays).toBe(0);

    // Paid intern without overtime task: 1.0 deductionDay
    const paidSummary = computeMonthlySummary(mockRecords, [], settings, true, {
      accessLevel: "intern",
      officeHours: 30,
      monthlySalary: 35000,
    });
    expect(paidSummary.deductionDays).toBe(1);

    // Paid intern with a 1-day compensatory overtime task (6 hours = 360 minutes = 1 dailyMinutes offset): reduces lateDaysOverThreshold from 2 to 1 -> 0.5 deductionDay
    const mockCompTask = [{
      id: "t1",
      title: "Compensatory work",
      assigneeId: "u1",
      date: "2026-07-05",
      status: "done",
      isOvertime: true,
      assignedHours: 6,
    }] as unknown as any[];

    const paidWithCompSummary = computeMonthlySummary(mockRecords, mockCompTask, settings, true, {
      accessLevel: "intern",
      officeHours: 30,
      monthlySalary: 35000,
    });
    expect(paidWithCompSummary.deductionDays).toBe(0.5);
  });
});

