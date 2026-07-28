import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { LeaveRequest, LeaveRequestStatus } from "./types";
import { logAdminAction } from "./logs";

const COL = "leaveRequests";

export function subscribeToAllLeaveRequests(
  onData: (reqs: LeaveRequest[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeaveRequest)),
    onError,
  );
}

export function subscribeToPendingLeaveRequests(
  onData: (reqs: LeaveRequest[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COL), where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeaveRequest)),
    onError,
  );
}

export function subscribeToMyLeaveRequests(
  uid: string,
  onData: (reqs: LeaveRequest[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COL), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const reqs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as LeaveRequest,
      );
      // Sort by createdAt descending locally to avoid requiring composite index
      reqs.sort((a, b) => {
        const aT = a.createdAt?.toMillis() || Infinity;
        const bT = b.createdAt?.toMillis() || Infinity;
        return bT - aT;
      });
      onData(reqs);
    },
    onError,
  );
}

export async function submitLeaveRequest(
  uid: string,
  employeeName: string,
  dates: string[],
  reason: string,
  proofUrls: string[],
): Promise<void> {
  const newRef = doc(collection(db, COL));
  await setDoc(newRef, {
    uid,
    employeeName,
    dates,
    reason,
    proofUrls,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateLeaveRequestStatus(
  id: string,
  status: LeaveRequestStatus,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction("Leave Request Evaluated", `Marked leave request (ID: ${id}) as ${status}`);
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
