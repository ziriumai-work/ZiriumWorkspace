// Firestore subscription helpers for reading attendance records.

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AttendanceRecord } from "@/lib/data/types";

const COL = "attendance";

/** Subscribe to ALL attendance records (admin view). */
export function subscribeToAllAttendance(
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COL), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord),
      ),
    onError,
  );
}

/** Subscribe to a single employee's attendance records. */
export function subscribeToMyAttendance(
  uid: string,
  onData: (records: AttendanceRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // We avoid orderBy("date", "desc") here to prevent requiring a composite index
  // (uid + date). Instead, we sort the results in memory.
  const q = query(collection(db, COL), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as AttendanceRecord,
      );
      records.sort((a, b) => b.date.localeCompare(a.date));
      onData(records);
    },
    onError,
  );
}
