import { describe, it, expect } from "./test-runner";
import { resolveODHAndPenalties } from "../src/lib/data/attendance/odh-clearing";
import type { AttendanceRecord, DailyTask, OfficeSettings } from "../src/lib/data/types";

const mockSettings: OfficeSettings = {
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
  id: "emp-1",
  accessLevel: "employee",
  monthlySalary: 5000,
  officeHours: 40, // 8h per day
};

const internUnpaid = {
  id: "int-1",
  accessLevel: "intern",
  monthlySalary: 0,
  officeHours: 30, // 6h per day
};

describe("ODH + Compensatory Toggles and Penalty-Clearing Rules", () => {
  it("should clear ODH and add clearing chip when assigning 5h to task with 5h ODH and linked penalty (§1 & §4)", () => {
    const records: AttendanceRecord[] = [
      {
        id: "rec-1",
        uid: "emp-1",
        employeeName: "John Doe",
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
      "2026-08-12": 300, // 5 hours ODH
    };

    const initialPenaltyMap = {
      "2026-08-12": [
        {
          type: "half_day",
          label: "-0.5d Salary",
          tooltip: "Half day salary deduction",
          color: "#ef4444",
          bgcolor: "#ef444420",
        },
      ],
    };

    const tasks: DailyTask[] = [
      {
        id: "task-1",
        title: "Fix bug",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-1",
        assigneeName: "John Doe",
        date: "2026-08-12",
        status: "done",
        report: { text: "done", updatedAt: null },
        assignedHours: 5,
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true,
        createdBy: "admin",
        createdAt: null,
        updatedAt: null,
      },
    ];

    const result = resolveODHAndPenalties(
      records,
      tasks,
      employeePaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08",
    );

    expect(result.odhMap["2026-08-12"]).toBe(0);
    const chips = result.penaltyMap["2026-08-12"];
    expect(chips.length).toBe(2);
    expect(chips[0].label).toBe("-0.5d Salary");
    expect(chips[1].label).toBe("+0.5d Salary (Task Cleared)");
    expect(chips[1].isClearingChip).toBe(true);
    expect(result.clearedDeductionDays).toBe(0.5);
  });

  it("should search same-day first, then backward same week, then earlier weeks (§3)", () => {
    const initialOdhMap = {
      "2026-08-05": 120,
      "2026-08-10": 120,
      "2026-08-12": 120,
    };

    const tasks: DailyTask[] = [
      {
        id: "task-2",
        title: "Multi-day clear",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-1",
        assigneeName: "John Doe",
        date: "2026-08-12",
        status: "done",
        report: { text: "done", updatedAt: null },
        assignedHours: 5,
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: false,
        createdBy: "admin",
        createdAt: null,
        updatedAt: null,
      },
    ];

    const result = resolveODHAndPenalties(
      [],
      tasks,
      employeePaid,
      mockSettings,
      initialOdhMap,
      {},
      "2026-08",
    );

    expect(result.odhMap["2026-08-12"]).toBe(0);
    expect(result.odhMap["2026-08-10"]).toBe(0);
    expect(result.odhMap["2026-08-05"]).toBe(60);
    expect(result.totalResolvedODHMinutes).toBe(300);
  });

  it("should resolve late/absent ODH penalty chip for Unpaid Intern without salary deduction (§4)", () => {
    const initialOdhMap = {
      "2026-08-12": 180,
    };

    const initialPenaltyMap = {
      "2026-08-12": [
        {
          type: "intern_late_odh",
          label: "+3h Late ODH",
          tooltip: "Late ODH penalty",
          color: "#f97316",
          bgcolor: "#f9731620",
        },
      ],
    };

    const tasks: DailyTask[] = [
      {
        id: "task-3",
        title: "Intern task",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "int-1",
        assigneeName: "Intern One",
        date: "2026-08-12",
        status: "done",
        report: { text: "done", updatedAt: null },
        assignedHours: 3,
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true,
        createdBy: "admin",
        createdAt: null,
        updatedAt: null,
      },
    ];

    const result = resolveODHAndPenalties(
      [],
      tasks,
      internUnpaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08",
    );

    expect(result.odhMap["2026-08-12"]).toBe(0);
    expect(result.clearedDeductionDays).toBe(0);
    const chips = result.penaltyMap["2026-08-12"];
    expect(chips.length).toBe(2);
    expect(chips[1].label).toBe("ODH Resolved (Task Cleared)");
    expect(chips[1].isClearingChip).toBe(true);
  });

  it("should skip absence day by default unless Compensatory Task = true (§4)", () => {
    const records: AttendanceRecord[] = [
      {
        id: "rec-abs",
        uid: "emp-1",
        employeeName: "John Doe",
        date: "2026-08-10",
        status: "absent",
        checkIn: "",
        checkOut: "",
        hoursWorked: 0,
      },
    ];

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
    };

    const taskWithoutComp: DailyTask = {
      id: "t-skip",
      title: "ODH only",
      description: "",
      projectId: null,
      projectTitle: null,
      assigneeId: "emp-1",
      assigneeName: "John Doe",
      date: "2026-08-12",
      status: "done",
      report: { text: "done", updatedAt: null },
      assignedHours: 8,
      isOvertime: true,
      resolvesODH: true,
      compensatesWeeklyHours: false,
      createdBy: "admin",
      createdAt: null,
      updatedAt: null,
    };

    const resSkip = resolveODHAndPenalties(
      records,
      [taskWithoutComp],
      employeePaid,
      mockSettings,
      {},
      initialPenaltyMap,
      "2026-08",
    );
    expect(resSkip.clearedDeductionDays).toBe(0);
    expect(resSkip.penaltyMap["2026-08-10"].length).toBe(1);

    const taskWithComp: DailyTask = {
      ...taskWithoutComp,
      id: "t-comp",
      compensatesWeeklyHours: true,
    };

    const resComp = resolveODHAndPenalties(
      records,
      [taskWithComp],
      employeePaid,
      mockSettings,
      {},
      initialPenaltyMap,
      "2026-08",
    );
    // Even with Compensates Weekly Hours = true, d !== taskDate skips absent days
    expect(resComp.clearedDeductionDays).toBe(0);

    const taskOnAbsentDay: DailyTask = {
      ...taskWithComp,
      id: "t-abs-day",
      date: "2026-08-10",
    };

    const resOnDay = resolveODHAndPenalties(
      records,
      [taskOnAbsentDay],
      employeePaid,
      mockSettings,
      {},
      initialPenaltyMap,
      "2026-08",
    );
    // Task assigned directly on the absent date (d === taskDate) clears the absent day
    expect(resOnDay.clearedDeductionDays).toBe(1);
    expect(resOnDay.penaltyMap["2026-08-10"].length).toBe(2);
    expect(resOnDay.penaltyMap["2026-08-10"][1].label).toBe("+1.0d Salary (Task Cleared)");
  });

  it("should absorb ODH across multiple days in the same week (5h Friday + 1h Thursday) when task hours exceed same-day ODH", () => {
    const initialOdhMap = {
      "2026-08-14": 300, // 5 hours ODH on Friday
      "2026-08-13": 196, // 3h 16m ODH on Thursday
    };

    const initialPenaltyMap = {
      "2026-08-14": [
        {
          type: "late",
          label: "Late",
          tooltip: "Late arrival",
          color: "#f59e0b",
          bgcolor: "#f59e0b20",
        },
      ],
    };

    const task6h: DailyTask = {
      id: "t-6h",
      title: "Salary deduction and odh",
      description: "",
      projectId: null,
      projectTitle: null,
      assigneeId: "emp-1",
      assigneeName: "Employee One",
      date: "2026-08-14",
      status: "done",
      report: { text: "done", updatedAt: null },
      assignedHours: 6,
      isOvertime: true,
      resolvesODH: false,
      compensatesWeeklyHours: true,
      createdBy: "admin",
      createdAt: null,
      updatedAt: null,
    };

    const result = resolveODHAndPenalties(
      [],
      [task6h],
      employeePaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08",
    );

    expect(result.odhMap["2026-08-14"]).toBe(0); // Absorbed all 5 hours on Friday
    expect(result.odhMap["2026-08-13"]).toBe(136); // Absorbed remaining 1 hour (196 - 60 = 136) on Thursday
    expect(result.totalResolvedODHMinutes).toBe(360); // Total 6 hours ODH resolved
    expect(result.clearedDeductionDays).toBe(0.5); // Also cleared late penalty on Friday
    expect(result.penaltyMap["2026-08-14"].length).toBe(2);
    expect(result.penaltyMap["2026-08-14"][1].label).toBe("+0.5d Salary (Task Cleared)");
  });

  it("should only clear 1 late day (3h) and absorb remaining 1h into 1 single earlier date when an Unpaid Intern with 2 late days is assigned a 4h Compensatory + ODH task", () => {
    const initialOdhMap = {
      "2026-08-19": 120, // 2 hours ODH on Wed 19 Aug
      "2026-08-14": 180, // 3 hours ODH on Fri 14 Aug
    };

    const initialPenaltyMap = {
      "2026-08-26": [
        {
          type: "intern_late_odh",
          label: "+3h Late ODH",
          tooltip: "Late Penalty Overtime Due",
          color: "#a855f7",
          bgcolor: "#a855f722",
          minutes: 180,
        },
      ],
      "2026-08-25": [
        {
          type: "intern_late_odh",
          label: "+3h Late ODH",
          tooltip: "Late Penalty Overtime Due",
          color: "#a855f7",
          bgcolor: "#a855f722",
          minutes: 180,
        },
      ],
    };

    const intern4hTask: DailyTask = {
      id: "t-4h-intern",
      title: "4h OT task",
      description: "",
      projectId: null,
      projectTitle: null,
      assigneeId: "int-1",
      assigneeName: "Intern John",
      date: "2026-08-26",
      status: "done",
      report: { text: "done", updatedAt: null },
      assignedHours: 4, // 4 hours = 240 minutes
      isOvertime: true,
      resolvesODH: true,
      compensatesWeeklyHours: true,
      createdBy: "admin",
      createdAt: null,
      updatedAt: null,
    };

    const resIntern = resolveODHAndPenalties(
      [],
      [intern4hTask],
      internUnpaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08",
    );

    // 1) 2026-08-26 late day should be CLEARED (cost 180 mins = 3 hours)
    expect(resIntern.penaltyMap["2026-08-26"].length).toBe(2);
    expect(resIntern.penaltyMap["2026-08-26"][1].label).toBe("ODH Resolved (Task Cleared)");

    // 2) 2026-08-25 late day should NOT be cleared (only 60 mins left, 180 mins required)
    expect(resIntern.penaltyMap["2026-08-25"].length).toBe(1);

    // 3) Remaining 60 mins (1 hour) should be absorbed into 2026-08-19 (leaving 60 mins ODH remaining)
    expect(resIntern.odhMap["2026-08-19"]).toBe(60); // 120 - 60 = 60
    const aug19Chips = resIntern.penaltyMap["2026-08-19"] || [];
    expect(aug19Chips.length).toBe(1);
    expect(aug19Chips[0].label).toBe("+1h 0m OT (2026-08-26 Task)");

    // 4) 2026-08-14 should NOT be touched at all
    expect(resIntern.odhMap["2026-08-14"]).toBe(180);
    expect(resIntern.penaltyMap["2026-08-14"]).toBe(undefined);
  });
});
