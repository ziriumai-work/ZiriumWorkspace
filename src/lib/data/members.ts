// assignee) and their public profiles.

import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Member, UserProfile } from "@/lib/data/types";

// rules. Returns an unsubscribe fn.
export function subscribeToMembers(
  onData: (members: Member[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "members"),
    (snap) =>
      onData(
        snap.docs.map((d) => ({ uid: d.id, ...(d.data() as object) }) as Member),
      ),
    (err) => onError?.(err),
  );
}

// UI can resolve an assigneeUid to a name+avatar.
export function subscribeToUserProfiles(
  onData: (byUid: Record<string, UserProfile>) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const byUid: Record<string, UserProfile> = {};
      snap.docs.forEach((d) => {
        byUid[d.id] = { uid: d.id, ...(d.data() as object) } as UserProfile;
      });
      onData(byUid);
    },
    (err) => onError?.(err),
  );
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists()
    ? ({ uid: snap.id, ...(snap.data() as object) } as UserProfile)
    : null;
}

export async function markWelcomeSeen(uid: string): Promise<void> {
  // Update only the hasSeenWelcome field (allowed by security rules for the member themselves)
  await updateDoc(doc(db, "members", uid), {
    hasSeenWelcome: true,
  });
}

export async function updateMemberRole(
  uid: string,
  role: "member" | "admin" | "owner",
): Promise<void> {
  await setDoc(doc(db, "members", uid), { role }, { merge: true });
}
