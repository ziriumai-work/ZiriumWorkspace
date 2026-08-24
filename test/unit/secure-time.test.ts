import { describe, it, expect } from "../test-runner";
import { isCheckInLate, calcOvertimeMinutes } from "../../src/lib/data/attendance/calculations";
import { isWithinOfficeHours } from "../../src/lib/data/attendance/settings";
import type { OfficeSettings } from "../../src/lib/data/types";

const settings: OfficeSettings = {
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

describe("Unit Testing: PKT Enforced Secure Time Calculations", () => {
  it("should enforce PKT timezone for isCheckInLate regardless of client offset", () => {
    // 04:15 UTC is exactly 09:15 PKT (+5 hours); deadline is 09:15 (09:00 + 15m grace) so ON TIME.
    const onTimeUTC = "2026-08-21T04:15:00.000Z";
    expect(isCheckInLate(onTimeUTC, settings)).toBe(false);

    // 04:16 UTC is 09:16 PKT. This is LATE.
    const lateUTC = "2026-08-21T04:16:00.000Z";
    expect(isCheckInLate(lateUTC, settings)).toBe(true);
  });

  it("should enforce PKT timezone for calcOvertimeMinutes", () => {
    // End time is 18:00 PKT (13:00 UTC); clock out at 14:00 UTC is exactly 19:00 PKT (60m OT).
    const checkOutUTC = "2026-08-21T14:00:00.000Z";
    const ot = calcOvertimeMinutes(checkOutUTC, settings);
    expect(ot).toBe(60);
  });

  it("should enforce PKT timezone for isWithinOfficeHours", () => {
    // 03:00 UTC is 08:00 PKT (Office Closed)
    const earlyUTC = new Date("2026-08-21T03:00:00.000Z");
    expect(isWithinOfficeHours(settings, earlyUTC)).toBe(false);

    // 05:00 UTC is 10:00 PKT (Office Open)
    const openUTC = new Date("2026-08-21T05:00:00.000Z");
    expect(isWithinOfficeHours(settings, openUTC)).toBe(true);

    // 14:00 UTC is 19:00 PKT (Office Closed)
    const lateUTC = new Date("2026-08-21T14:00:00.000Z");
    expect(isWithinOfficeHours(settings, lateUTC)).toBe(false);
  });
});
