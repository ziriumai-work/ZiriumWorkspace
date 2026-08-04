import { type AttendanceStatus } from "@/lib/data/types";

// Colour map for attendance status chips.
export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "#22c55e",
  late: "#f59e0b",
  absent: "#ef4444",
  on_leave: "#a855f7",
  sick_leave: "#ec4899", // pink for sick leave
  clock_out: "#3b82f6", // blue for clock out
};

export function fmtTime(iso: string | null): string {
  if (!iso || iso.trim() === "") return "—";
  try {
    const timeMatch = iso.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[AaPp][Mm])?$/);
    if (timeMatch) {
      if (timeMatch[4]) {
        return iso;
      }
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    return iso;
  } catch {
    return iso || "—";
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
