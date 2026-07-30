// Global office settings subscriptions and admin management.

import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_OFFICE_SETTINGS, type OfficeSettings } from "@/lib/data/types";
import { logAdminAction } from "../logs";

export function subscribeToOfficeSettings(
  onData: (settings: OfficeSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "settings", "office"),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as OfficeSettings);
      } else {
        onData(DEFAULT_OFFICE_SETTINGS);
      }
    },
    onError,
  );
}

export async function updateOfficeSettings(
  settings: Partial<OfficeSettings>,
): Promise<void> {
  await setDoc(doc(db, "settings", "office"), settings, { merge: true });
  await logAdminAction(
    "Updated Office Settings",
    `Updated office config: ${Object.keys(settings).join(", ")}`,
  );
}

export function normalizeOfficeHours(settings: OfficeSettings): {
  startH: number;
  startM: number;
  endH: number;
  endM: number;
} {
  let startH = Number(settings.startHour) || 10;
  const startM = Number(settings.startMinute) || 0;
  let endH = Number(settings.endHour) || 18;
  const endM = Number(settings.endMinute) || 0;

  // Normalize 12-hour PM input:
  // e.g., if start is 10 (AM) and end is 6 (PM), convert end to 18.
  // e.g., if start is 2 (PM) and end is 6 (PM), convert both 2 -> 14 and 6 -> 18.
  if (startH >= 1 && startH <= 6 && endH > startH && endH <= 11) {
    startH += 12;
    endH += 12;
  } else if (startH >= 7 && startH <= 12 && endH >= 1 && endH <= 9) {
    endH += 12;
  }

  return { startH, startM, endH, endM };
}

export function isWithinOfficeHours(settings: OfficeSettings, currentTime?: Date): boolean {
  const now = currentTime ? new Date(currentTime) : new Date();
  const { startH, startM, endH, endM } = normalizeOfficeHours(settings);

  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);

  const end = new Date(now);
  end.setHours(endH, endM, 59, 999);

  // If start is after end (e.g. overnight shift 10 PM to 6 AM -> 22:00 to 06:00),
  // then we are in office hours if now >= start OR now <= end.
  if (start > end) {
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}
