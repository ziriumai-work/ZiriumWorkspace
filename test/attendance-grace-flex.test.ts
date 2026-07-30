import { describe, it, expect } from "./test-runner";
import { isCheckInLate } from "../src/lib/data/attendance/calculations";
import { type OfficeSettings } from "../src/lib/data/types";

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

function computeLateMinutesWithGrace(
  checkInIso: string,
  settings: OfficeSettings
): { isLate: boolean; lateMinutes: number } {
  const now = new Date(checkInIso);
  const officeStart = new Date(now);
  officeStart.setHours(settings.startHour, settings.startMinute, 0, 0);

  const graceDeadline = new Date(officeStart);
  graceDeadline.setMinutes(graceDeadline.getMinutes() + (settings.graceMinutes || 0));

  if (now > graceDeadline) {
    const lateMinutes = Math.floor((now.getTime() - graceDeadline.getTime()) / 60000);
    return { isLate: true, lateMinutes };
  }
  return { isLate: false, lateMinutes: 0 };
}

describe("Attendance Grace Period & Flexibility Calculation", () => {
  it("should mark check-in at 10:15 AM as NOT LATE with 0 lateMinutes (within grace period)", () => {
    const checkIn = new Date();
    checkIn.setHours(10, 15, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeFalsy();

    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeFalsy();
    expect(res.lateMinutes).toBe(0);
  });

  it("should mark check-in at 10:30 AM as NOT LATE with 0 lateMinutes (exact grace deadline)", () => {
    const checkIn = new Date();
    checkIn.setHours(10, 30, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeFalsy();

    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeFalsy();
    expect(res.lateMinutes).toBe(0);
  });

  it("should mark check-in at 10:45 AM as LATE and deduct only 15 minutes of flex time (NOT 45 minutes)", () => {
    const checkIn = new Date();
    checkIn.setHours(10, 45, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeTruthy();

    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeTruthy();
    expect(res.lateMinutes).toBe(15);
  });

  it("should mark check-in at 11:00 AM as LATE and deduct 30 minutes of flex time", () => {
    const checkIn = new Date();
    checkIn.setHours(11, 0, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeTruthy();

    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeTruthy();
    expect(res.lateMinutes).toBe(30);
  });
});
