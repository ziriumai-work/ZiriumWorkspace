import { describe, it, expect } from "./test-runner";
import { type OfficeSettings } from "../src/lib/data/types";

function shouldAutoClockOut(
  shiftDateStr: string,
  now: Date,
  settings: OfficeSettings
): boolean {
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const startH = Number(settings.startHour) || 10;
  const endH = Number(settings.endHour) || 18;
  const endM = Number(settings.endMinute) || 0;

  const todayEnd = new Date(now);
  todayEnd.setHours(endH, endM, 0, 0);

  if (endH < startH) {
    // Overnight shift (e.g. 10 PM to 6 AM): only close shift from previous date once morning closing time passes
    return shiftDateStr < todayStr && now > todayEnd;
  } else {
    // Regular daytime shift
    if (shiftDateStr < todayStr) return true;
    return shiftDateStr === todayStr && now > todayEnd;
  }
}

const daySettings: OfficeSettings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1,
};

const nightSettings: OfficeSettings = {
  ...daySettings,
  startHour: 22,
  endHour: 6,
};

describe("Auto Clock-Out Condition Logic (Daytime vs Overnight Shift)", () => {
  it("should NOT close daytime shift during work hours (1:00 PM / 13:00)", () => {
    const now = new Date("2026-07-30T13:00:00");
    expect(shouldAutoClockOut("2026-07-30", now, daySettings)).toBeFalsy();
  });

  it("should close daytime shift once office closing time passes (6:05 PM / 18:05)", () => {
    const now = new Date("2026-07-30T18:05:00");
    expect(shouldAutoClockOut("2026-07-30", now, daySettings)).toBeTruthy();
  });

  it("should NOT prematurely close an overnight shift at 2:00 AM after midnight (before 6:00 AM closing)", () => {
    const now = new Date("2026-07-31T02:00:00");
    // Shift was started on 2026-07-30 at 10 PM
    expect(shouldAutoClockOut("2026-07-30", now, nightSettings)).toBeFalsy();
  });

  it("should close an overnight shift at 6:05 AM once the night shift morning closing time passes", () => {
    const now = new Date("2026-07-31T06:05:00");
    expect(shouldAutoClockOut("2026-07-30", now, nightSettings)).toBeTruthy();
  });
});
