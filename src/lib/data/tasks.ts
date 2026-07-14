// Data access for daily tasks (Firestore "tasks" collection).
// Admins assign tasks to employees; employees update status + report.
// Access is gated by firestore.rules; admin-only actions are gated in the UI.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { DailyTask, TaskReport } from "@/lib/data/types";

const COLLECTION = "tasks";

const EMPTY_REPORT: TaskReport = { text: "", links: [], files: [] };

function toTask(id: string, data: Record<string, unknown>): DailyTask {
  const report = (data.report as Partial<TaskReport>) ?? {};
  return {
    id,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    projectId: (data.projectId as string | null) ?? null,
    projectTitle: (data.projectTitle as string | null) ?? null,
    assigneeId: (data.assigneeId as string) ?? "",
    assigneeName: (data.assigneeName as string) ?? "",
    date: (data.date as string) ?? "",
    status: (data.status as DailyTask["status"]) ?? "todo",
    report: {
      text: report.text ?? "",
      links: report.links ?? [],
      files: report.files ?? [],
    },
    createdBy: (data.createdBy as string) ?? "",
    createdAt: (data.createdAt as Timestamp | null) ?? null,
    updatedAt: (data.updatedAt as Timestamp | null) ?? null,
  };
}

// Admin view: every task, newest day first.
export function subscribeToAllTasks(
  onData: (tasks: DailyTask[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toTask(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

// Employee view: only my tasks. Uses an equality filter (no composite index
// needed) and sorts by date client-side.
export function subscribeToTasksForEmployee(
  employeeId: string,
  onData: (tasks: DailyTask[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where("assigneeId", "==", employeeId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => toTask(d.id, d.data()));
      tasks.sort((a, b) => b.date.localeCompare(a.date));
      onData(tasks);
    },
    (err) => onError?.(err),
  );
}

export type NewTask = {
  title: string;
  description?: string;
  projectId?: string | null;
  projectTitle?: string | null;
  assigneeId: string;
  assigneeName: string;
  date: string;
};

export async function createTask(
  input: NewTask,
  createdByUid: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    projectId: input.projectId ?? null,
    projectTitle: input.projectTitle ?? null,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    date: input.date,
    status: "todo",
    report: EMPTY_REPORT,
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<DailyTask, "title" | "description" | "status" | "report" | "date">
  >,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
