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

export function isWithinOfficeHours(settings: OfficeSettings): boolean {
  const now = new Date();

  const startH = Number(settings.startHour) || 10;
  const startM = Number(settings.startMinute) || 0;
  const endH = Number(settings.endHour) || 18;
  const endM = Number(settings.endMinute) || 0;

  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);

  const end = new Date(now);
  end.setHours(endH, endM, 0, 0);

  // If start is after end (e.g. overnight shift 10 PM to 6 AM -> 22:00 to 06:00),
  // then we are in office hours if now >= start OR now <= end.
  if (start > end) {
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}
