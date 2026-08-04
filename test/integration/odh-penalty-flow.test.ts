import { describe, it, expect } from "../test-runner";
import { resolveODHAndPenalties } from "../../src/lib/data/attendance/odh-clearing";
import type { AttendanceRecord, DailyTask, OfficeSettings } from "../../src/lib/data/types";

const integrationSettings: OfficeSettings = {
  id: "default",
  officeStartTime: "10:00",
  officeEndTime: "18:00",
  graceMinutes: 60,
  flexibilityHours: 3,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 2,
  weeklyHoursRequired: 40,
  internWeeklyHoursRequired: 30,
};

const employeePaid = {
  id: "emp-flow",
  accessLevel: "employee",
  monthlySalary: 6000,
  officeHours: 40, // 8h per day -> 480 mins
};

describe("Integration Testing: ODH + Compensatory Penalty-Clearing Flow", () => {
  it("should execute full multi-day ODH absorption and audit-trail chip clearing across week and absence days", () => {
    const records: AttendanceRecord[] = [
      {
        id: "rec-abs-10",
        uid: "emp-flow",
        employeeName: "Alice Smith",
        date: "2026-08-10",
        status: "absent",
        checkIn: "",
        checkOut: "",
        hoursWorked: 0,
      },
      {
        id: "rec-late-12",
        uid: "emp-flow",
        employeeName: "Alice Smith",
        date: "2026-08-12",
        status: "present",
        checkIn: "14:00",
        checkOut: "17:00",
        hoursWorked: 3,
        flexibilityUsed: 0,
        isLate: true,
        lateMinutes: 180,
      },
    ];

    const initialOdhMap = {
      "2026-08-12": 300, // 5 hours ODH shortfall on Aug 12
    };

    const initialPenaltyMap = {
      "2026-08-10": [
        {
          type: "absent",
          label: "-1d Salary",
          tooltip: "Absent day deduction",
          color: "#ef4444",
          bgcolor: "#ef444420",
        },
      ],
      "2026-08-12": [
        {
          type: "late",
          label: "-0.5d Salary",
          tooltip: "Late arrival salary deduction",
          color: "#ef4444",
          bgcolor: "#ef444420",
        },
      ],
    };

    // Admin assigns a 5h task on Aug 12 and an 8h task on Aug 10 (absence date)
    // - 5h on Aug 12 clears Aug 12 ODH (300m) and Aug 12 Late penalty (-0.5d Salary)
    // - 8h on Aug 10 clears Aug 10 absence day (480m standard daily hours) and Absence penalty (-1d Salary)
    const tasks: DailyTask[] = [
      {
        id: "task-integ-1",
        title: "Major System Release & Comp Work",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-flow",
        assigneeName: "Alice Smith",
        date: "2026-08-12",
        status: "done",
        report: { text: "Completed release", updatedAt: null },
        assignedHours: 5, // 5 hours = 300 minutes
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true, // BOTH ON
        createdBy: "admin",
        createdAt: null,
        updatedAt: null,
      },
      {
        id: "task-integ-2",
        title: "Absence make-up task",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-flow",
        assigneeName: "Alice Smith",
        date: "2026-08-10", // Assigned exactly on absence date (d === taskDate)
        status: "done",
        report: { text: "Make up work", updatedAt: null },
        assignedHours: 8, // 8 hours = 480 minutes
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true, // BOTH ON
        createdBy: "admin",
        createdAt: null,
        updatedAt: null,
      },
    ];

    const result = resolveODHAndPenalties(
      records,
      tasks,
      employeePaid,
      integrationSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08",
    );

    // 1. Check ODH balances
    expect(result.odhMap["2026-08-12"]).toBe(0); // 5h absorbed
    expect(result.odhMap["2026-08-10"]).toBe(0); // 8h absorbed
    expect(result.totalResolvedODHMinutes).toBe(780);

    // 2. Check Audit Trail Flags on Aug 12
    const aug12Chips = result.penaltyMap["2026-08-12"];
    expect(aug12Chips.length).toBe(2);
    expect(aug12Chips[0].label).toBe("-0.5d Salary"); // Original penalty preserved
    expect(aug12Chips[1].label).toBe("+0.5d Salary (Task Cleared)"); // Green clearing chip added
    expect(aug12Chips[1].isClearingChip).toBe(true);

    // 3. Check Audit Trail Flags on Aug 10 (Absence day)
    const aug10Chips = result.penaltyMap["2026-08-10"];
    expect(aug10Chips.length).toBe(2);
    expect(aug10Chips[0].label).toBe("-1d Salary"); // Original penalty preserved
    expect(aug10Chips[1].label).toBe("+1.0d Salary (Task Cleared)"); // Green clearing chip added
    expect(aug10Chips[1].isClearingChip).toBe(true);

    // 4. Verify total net salary deduction cleared days
    expect(result.clearedDeductionDays).toBe(1.5); // 0.5d late + 1.0d absence = 1.5 days cleared
  });
});
