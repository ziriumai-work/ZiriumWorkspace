import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { PersonalTask } from "./types";

const COL = "personal_tasks";

export async function createPersonalTask(task: Omit<PersonalTask, "id" | "createdAt" | "updatedAt">): Promise<void> {
  const newRef = doc(collection(db, COL));
  await setDoc(newRef, {
    ...task,
    id: newRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePersonalTask(id: string, patch: Partial<PersonalTask>): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePersonalTask(id: string): Promise<void> {
  const ref = doc(db, COL, id);
  await deleteDoc(ref);
}

export function subscribeToPersonalTasks(uid: string, onUpdate: (tasks: PersonalTask[]) => void): () => void {
  const q = query(collection(db, COL), where("uid", "==", uid));
  return onSnapshot(q, (snap) => {
    const tasks: PersonalTask[] = [];
    snap.forEach((d) => {
      tasks.push({ ...d.data(), id: d.id } as PersonalTask);
    });
    onUpdate(tasks);
  });
}

export async function getActivePersonalTasks(uid: string): Promise<PersonalTask[]> {
  const q = query(
    collection(db, COL),
    where("uid", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const tasks: PersonalTask[] = [];
  snap.forEach((d) => {
    tasks.push({ ...d.data(), id: d.id } as PersonalTask);
  });
  return tasks;
}
