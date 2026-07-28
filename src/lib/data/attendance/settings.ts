// Global office settings subscriptions and admin management.

import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_OFFICE_SETTINGS, type OfficeSettings } from "@/lib/data/types";
import { logAdminAction } from "../logs";

/** Subscribe to the global office settings document. */
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

/** Admin: update the global office settings. */
export async function updateOfficeSettings(
  settings: Partial<OfficeSettings>,
): Promise<void> {
  await setDoc(doc(db, "settings", "office"), settings, { merge: true });
  await logAdminAction(
    "Updated Office Settings",
    `Updated office config: ${Object.keys(settings).join(", ")}`,
  );
}

/** Check if currently within allowed clock-in/out window. */
export function isWithinOfficeHours(settings: OfficeSettings): boolean {
  const now = new Date();
  const start = new Date(now);
  start.setHours(settings.startHour, settings.startMinute, 0, 0);
  // Allow clock-out up to 4 hours after office end (for overtime).
  const end = new Date(now);
  end.setHours(settings.endHour + 4, settings.endMinute, 0, 0);
  return now >= start && now <= end;
}
