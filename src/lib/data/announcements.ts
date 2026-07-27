import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/client";
import type { Announcement } from "./types";
import { logAdminAction } from "./logs";

export function subscribeToAnnouncements(
  onData: (announcements: Announcement[]) => void,
  onError: (error: Error) => void
) {
  const q = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const allAnnouncements = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Announcement)
      );

      // Filter out expired announcements locally for active banner display.
      // Admins might need to see expired ones to delete them, but for simplicity,
      // we'll fetch all and the UI can decide what to show.
      onData(allAnnouncements);
    },
    (err) => {
      onError(err);
    }
  );
}

export async function createAnnouncement(data: Omit<Announcement, "id" | "createdAt">) {
  const ref = doc(collection(db, "announcements"));
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logAdminAction("Created Announcement", `Created announcement: ${data.title}`);
  return ref.id;
}

export async function updateAnnouncement(id: string, data: Partial<Omit<Announcement, "id" | "createdAt">>) {
  const ref = doc(db, "announcements", id);
  // We use setDoc with merge to update fields, as we're treating the whole doc.
  await setDoc(ref, data, { merge: true });
  await logAdminAction("Updated Announcement", `Updated announcement (ID: ${id})`);
}

export async function deleteAnnouncement(id: string) {
  const ref = doc(db, "announcements", id);
  await deleteDoc(ref);
  await logAdminAction("Deleted Announcement", `Deleted announcement (ID: ${id})`);
}
