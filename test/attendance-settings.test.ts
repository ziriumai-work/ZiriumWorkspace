import { describe, it, expect } from "./test-runner";
import { isWithinOfficeHours } from "../src/lib/data/attendance/settings";
import { type OfficeSettings } from "../src/lib/data/types";

const defaultSettings: OfficeSettings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1,
};


function getWeekdayDate(): Date {
  return new Date(2026, 7, 3); // Monday, Aug 3, 2026
}

describe("Office Settings: isWithinOfficeHours (Daytime Shift 10 AM to 6 PM)", () => {
  it("should return TRUE for check-in at 10:00 AM (exact start time)", () => {
    const d = getWeekdayDate();
    d.setHours(10, 0, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeTruthy();
  });

  it("should return TRUE for check-in at 1:00 PM (13:00 - mid day intern check-in)", () => {
    const d = getWeekdayDate();
    d.setHours(13, 0, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeTruthy();
  });

  it("should return TRUE for check-in at 6:00 PM (18:00 - exact end time)", () => {
    const d = getWeekdayDate();
    d.setHours(18, 0, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeTruthy();
  });

  it("should return FALSE for check-in at 9:59 AM (before office start)", () => {
    const d = getWeekdayDate();
    d.setHours(9, 59, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeFalsy();
  });

  it("should return FALSE for check-in at 6:01 PM (18:01 - after office end)", () => {
    const d = getWeekdayDate();
    d.setHours(18, 1, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeFalsy();
  });

  it("should return FALSE on Saturday or Sunday (weekend - office closed)", () => {
    const sat = new Date(2026, 7, 8, 12, 0, 0); // Saturday Aug 8, 2026
    const sun = new Date(2026, 7, 9, 12, 0, 0); // Sunday Aug 9, 2026
    expect(isWithinOfficeHours(defaultSettings, sat)).toBeFalsy();
    expect(isWithinOfficeHours(defaultSettings, sun)).toBeFalsy();
  });
});

describe("Office Settings: isWithinOfficeHours (Overnight Shift 10 PM to 6 AM)", () => {
  const nightSettings: OfficeSettings = {
    ...defaultSettings,
    startHour: 22, // 10 PM
    endHour: 6,    // 6 AM
  };

  it("should return TRUE for check-in at 10:00 PM (22:00)", () => {
    const d = getWeekdayDate();
    d.setHours(22, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings, d)).toBeTruthy();
  });

  it("should return TRUE for check-in at 11:30 PM (23:30)", () => {
    const d = getWeekdayDate();
    d.setHours(23, 30, 0, 0);
    expect(isWithinOfficeHours(nightSettings, d)).toBeTruthy();
  });

  it("should return TRUE for check-in at 3:00 AM (03:00)", () => {
    const d = getWeekdayDate();
    d.setHours(3, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings, d)).toBeTruthy();
  });

  it("should return TRUE for check-in at 6:00 AM (06:00)", () => {
    const d = getWeekdayDate();
    d.setHours(6, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings, d)).toBeTruthy();
  });

  it("should return FALSE for check-in at 1:00 PM (13:00 - outside night shift)", () => {
    const d = getWeekdayDate();
    d.setHours(13, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings, d)).toBeFalsy();
  });

  it("should return FALSE for check-in at 9:00 PM (21:00 - 1 hour before night shift start)", () => {
    const d = getWeekdayDate();
    d.setHours(21, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings, d)).toBeFalsy();
  });
});

describe("Office Settings: 12-Hour Format Normalization (startHour: 10, endHour: 6)", () => {
  const pmSettings: OfficeSettings = {
    ...defaultSettings,
    startHour: 10,
    endHour: 6, // 6 PM saved as 12-hour format '6'
  };

  it("should return TRUE for check-in at 1:22 PM (13:22) when endHour is saved as 6 (12-hour format)", () => {
    const d = getWeekdayDate();
    d.setHours(13, 22, 0, 0);
    expect(isWithinOfficeHours(pmSettings, d)).toBeTruthy();
  });

  it("should return TRUE for check-in at 5:59 PM (17:59) when endHour is saved as 6", () => {
    const d = getWeekdayDate();
    d.setHours(17, 59, 0, 0);
    expect(isWithinOfficeHours(pmSettings, d)).toBeTruthy();
  });

  it("should return FALSE for check-in at 6:05 PM (18:05) after office closes", () => {
    const d = getWeekdayDate();
    d.setHours(18, 5, 0, 0);
    expect(isWithinOfficeHours(pmSettings, d)).toBeFalsy();
  });
});
