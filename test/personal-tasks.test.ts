import { describe, it, expect } from "./test-runner";
import { shouldNotifyTask } from "../src/lib/data/personal-tasks-utils";
import type { PersonalTask } from "../src/lib/data/types";

const baseTask: PersonalTask = {
  id: "task-1",
  uid: "user-1",
  title: "Test Task",
  priority: "High",
  category: "Work",
  status: "pending",
  isRoutine: false,
  targetDate: "2026-08-18",
  targetTime: "10:30",
  notifyMinutesBefore: 30,
  createdAt: null,
  updatedAt: null,
};

describe("Personal Tasks: Unit & Integration Tests", () => {
  it("should return TRUE when time is exactly within the notification window", () => {
    // Target is 10:30 (630 mins). Current time is 10:00 (600 mins). Window is 30 mins. Diff = 30.
    const result = shouldNotifyTask(baseTask, 2, "2026-08-18", 600);
    expect(result).toBeTruthy();
  });

  it("should return FALSE when task is already marked as done", () => {
    const doneTask = { ...baseTask, status: "done" as const };
    const result = shouldNotifyTask(doneTask, 2, "2026-08-18", 600);
    expect(result).toBeFalsy();
  });

  it("should return FALSE when email has already been sent", () => {
    const emailedTask = { ...baseTask, emailSent: true };
    const result = shouldNotifyTask(emailedTask, 2, "2026-08-18", 600);
    expect(result).toBeFalsy();
  });

  it("should return FALSE if current time is before the notification window", () => {
    // Target is 10:30 (630 mins). Current time is 09:00 (540 mins). Diff = 90.
    const result = shouldNotifyTask(baseTask, 2, "2026-08-18", 540);
    expect(result).toBeFalsy();
  });

  it("should return FALSE if current time is past the target time", () => {
    // Target is 10:30 (630 mins). Current time is 10:45 (645 mins). Diff = -15.
    const result = shouldNotifyTask(baseTask, 2, "2026-08-18", 645);
    expect(result).toBeFalsy();
  });

  it("should return FALSE if the one-time task is scheduled for a different date", () => {
    const result = shouldNotifyTask(baseTask, 2, "2026-08-19", 600);
    expect(result).toBeFalsy();
  });

  it("should return TRUE for a routine task on a matching day", () => {
    const routineTask = {
      ...baseTask,
      isRoutine: true,
      routineDays: [1, 2, 3], // Mon, Tue, Wed
    };
    // Current day is 2 (Tuesday), Current time is 10:15 (615 mins). Diff = 15.
    const result = shouldNotifyTask(routineTask, 2, "2026-08-18", 615);
    expect(result).toBeTruthy();
  });

  it("should return FALSE for a routine task on a non-matching day", () => {
    const routineTask = {
      ...baseTask,
      isRoutine: true,
      routineDays: [1, 3], // Mon, Wed
    };
    // Current day is 2 (Tuesday)
    const result = shouldNotifyTask(routineTask, 2, "2026-08-18", 615);
    expect(result).toBeFalsy();
  });

  it("should handle custom notify minutes correctly", () => {
    const customTask = { ...baseTask, notifyMinutesBefore: 60 };
    // Target is 10:30 (630 mins). Current time is 09:30 (570 mins). Diff = 60.
    const result = shouldNotifyTask(customTask, 2, "2026-08-18", 570);
    expect(result).toBeTruthy();
  });
});
