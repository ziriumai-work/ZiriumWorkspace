import { PersonalTask } from "./types";

export function shouldNotifyTask(
  t: PersonalTask,
  currentDayIndex: number,
  todayIso: string,
  currentTimeMinutes: number
): boolean {
  if (t.status !== "pending" || t.emailSent) return false;

  let isActiveToday = false;
  if (t.isRoutine && t.routineDays?.includes(currentDayIndex)) {
    isActiveToday = true;
  } else if (!t.isRoutine && t.targetDate === todayIso) {
    isActiveToday = true;
  }

  if (isActiveToday && t.targetTime) {
    const [h, m] = t.targetTime.split(":").map(Number);
    const targetMins = h * 60 + m;
    const diff = targetMins - currentTimeMinutes;

    if (diff >= 0 && diff <= t.notifyMinutesBefore) {
      return true;
    }
  }

  return false;
}
