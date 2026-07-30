import { describe, it, expect } from "./test-runner";
import { computeMonthlySummary } from "../src/lib/data/attendance/calculations";
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
      { id: "1", uid: "int1", date: "2026-07-01", status: "late", isLate: true },
      { id: "2", uid: "int1", date: "2026-07-02", status: "late", isLate: true },
      { id: "3", uid: "int1", date: "2026-07-03", status: "late", isLate: true },
      { id: "4", uid: "int1", date: "2026-07-04", status: "late", isLate: true }, // 4th late day (1 over threshold)
      { id: "5", uid: "int1", date: "2026-07-05", status: "late", isLate: true }, // 5th late day (2 over threshold)
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
      { id: "1", uid: "emp1", date: "2026-07-01", status: "late", isLate: true },
      { id: "2", uid: "emp1", date: "2026-07-02", status: "late", isLate: true },
      { id: "3", uid: "emp1", date: "2026-07-03", status: "late", isLate: true },
      { id: "4", uid: "emp1", date: "2026-07-04", status: "late", isLate: true }, // 4th late day (1 over threshold)
      { id: "5", uid: "emp1", date: "2026-07-05", status: "late", isLate: true }, // 5th late day (2 over threshold)
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
});
