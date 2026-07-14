// Data access for company members (used by people pickers, e.g. project
// assignee) and their public profiles.

import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Member, UserProfile } from "@/lib/data/types";

// Subscribe to the full member list. Members can read all memberships per the
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

// Subscribe to every user profile (display name / photo) keyed by uid, so the
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
