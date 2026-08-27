import { describe, it, expect } from "../test-runner";
import { computeMonthlySummary, calculateDynamicAllowedLeaves } from "../../src/lib/data/attendance/calculations";
import type { AttendanceRecord, OfficeSettings, Developer } from "../../src/lib/data/types";

const mockSettings: OfficeSettings = {
  id: "default",
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 15,
  flexibilityHours: 3,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 2,
  weeklyHoursRequired: 40,
  internWeeklyHoursRequired: 30,
};

const mockEmployee: Developer = {
  id: "emp-mock",
  uid: "emp-mock",
  name: "Mock Employee",
  email: "mock@example.com",
  accessLevel: "employee",
  monthlySalary: 6000,
  officeHours: 40,
  startDate: "2026-07-01",
};

describe("Unit Testing: Admin Leave Logic", () => {
  it("should not count adminApprovedLeave towards standard leaves taken", () => {
    const records: AttendanceRecord[] = [
      {
        id: "1",
        uid: "emp-mock",
        date: "2026-08-01",
        status: "on_leave",
        employeeName: "Mock",
        checkIn: "",
        checkOut: "",
        hoursWorked: 0,
      },
      {
        id: "2",
        uid: "emp-mock",
        date: "2026-08-02",
        status: "on_leave",
        adminApprovedLeave: true, // This should be ignored!
        employeeName: "Mock",
        checkIn: "",
        checkOut: "",
        hoursWorked: 0,
      },
    ];

    const summary = computeMonthlySummary(
      records,
      [],
      mockSettings,
      false, // not intern
      mockEmployee,
      records,
      "2026-08"
    );

    // Employee took 2 leaves total, but 1 was Admin Approved.
    // So totalLeaves (standard leaves that consume allowance) should be 1.
    // totalAdminLeaves should be 1.
    expect(summary.totalLeaves).toBe(1);
    expect(summary.totalAdminLeaves).toBe(1);
  });

  it("should not reduce allowed leaves (rollover) or trigger penalties for adminApprovedLeave", () => {
    const records: AttendanceRecord[] = [
      // July (previous month) admin leave. Should NOT consume July's 2 base leaves.
      // So August should receive +2 rollover leaves.
      { id: "0", uid: "emp-mock", date: "2026-07-15", status: "on_leave", adminApprovedLeave: true, employeeName: "Mock", checkIn: "", checkOut: "", hoursWorked: 0 },
      // August (current month) admin leaves
      { id: "1", uid: "emp-mock", date: "2026-08-01", status: "on_leave", adminApprovedLeave: true, employeeName: "Mock", checkIn: "", checkOut: "", hoursWorked: 0 },
      { id: "2", uid: "emp-mock", date: "2026-08-02", status: "on_leave", adminApprovedLeave: true, employeeName: "Mock", checkIn: "", checkOut: "", hoursWorked: 0 },
      { id: "3", uid: "emp-mock", date: "2026-08-03", status: "on_leave", adminApprovedLeave: true, employeeName: "Mock", checkIn: "", checkOut: "", hoursWorked: 0 }
    ];

    const allowed = calculateDynamicAllowedLeaves({
      employee: mockEmployee,
      settings: mockSettings,
      targetMonthStr: "2026-08",
      allAttendanceRecords: records,
    });
    
    // They get 2 base leaves for August. 
    // Since their July leave was Admin Approved, it didn't consume their July allowance.
    // So 2 leaves roll over from July -> Total 4 allowed in August.
    expect(allowed).toBe(4);
    
    const summary = computeMonthlySummary(
      records,
      [],
      mockSettings,
      false,
      mockEmployee,
      records,
      "2026-08"
    );

    // Excess leaves penalty should be 0 since Admin leaves are exempt.
    expect(summary.excessLeaves).toBe(0);
    // Deduction days should be 0
    expect(summary.deductionDays).toBe(0);
  });
});
