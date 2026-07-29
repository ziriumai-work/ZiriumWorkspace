import { type AttendanceStatus } from "@/lib/data/types";

// Colour map for attendance status chips.
export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "#22c55e",
  late: "#f59e0b",
  absent: "#ef4444",
  on_leave: "#a855f7",
  sick_leave: "#ec4899", // pink for sick leave
};

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatHoursMinutes(hrs: number): string {
  if (isNaN(hrs) || !isFinite(hrs) || hrs <= 0) return "—";
  const totalMinutes = Math.round(hrs * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function calcHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn) return "—";
  const outTime = checkOut ? new Date(checkOut) : new Date();
  const hrs = (outTime.getTime() - new Date(checkIn).getTime()) / 3_600_000;
  return formatHoursMinutes(hrs);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isFutureStartDate(startDate?: string | null): boolean {
  if (!startDate) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return startDate > todayStr;
}

import { getWorkingDaysInWeekFromStart as _getWorkingDays } from "@/lib/data/attendance/calculations";
export const getWorkingDaysInWeekFromStart = _getWorkingDays;
