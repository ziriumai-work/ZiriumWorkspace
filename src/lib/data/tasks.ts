
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { DailyTask, TaskReport, TaskFile } from "@/lib/data/types";
import { logAdminAction } from "./logs";

const COLLECTION = "tasks";

const EMPTY_REPORT: TaskReport = { text: "", links: [], files: [] };

function toTask(id: string, data: Record<string, unknown>): DailyTask {
  const report = (data.report as Partial<TaskReport>) ?? {};
  const legacyReport: TaskReport = {
    text: report.text ?? "",
    links: report.links ?? [],
    files: report.files ?? [],
    type: report.type ?? "report",
    createdAt: report.createdAt ?? "",
    createdBy: report.createdBy ?? "",
    createdByName: report.createdByName ?? "",
  };
  
  let reports = (data.reports as TaskReport[]) ?? [];
  if (reports.length === 0 && (legacyReport.text || legacyReport.links.length > 0 || legacyReport.files.length > 0)) {
    reports = [legacyReport];
  }

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
    report: legacyReport,
    reports,
    assignedHours: (data.assignedHours as number) ?? 0,
    isOvertime: (data.isOvertime as boolean) ?? false,
    compensatesWeeklyHours: (data.compensatesWeeklyHours as boolean) ?? false,
    overtimeCost: (data.overtimeCost as number) ?? 0,
    attachments: (data.attachments as TaskFile[]) ?? [],
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
  taskId?: string; // If pre-generated for file uploads
  title: string;
  description?: string;
  projectId?: string | null;
  projectTitle?: string | null;
  assigneeId: string;
  assigneeName: string;
  date: string;
  assignedHours?: number;
  isOvertime?: boolean;
  compensatesWeeklyHours?: boolean;
  overtimeCost?: number;
  attachments?: TaskFile[];
};

export async function createTask(
  input: NewTask,
  createdByUid: string,
): Promise<string> {
  const id = input.taskId ?? doc(collection(db, COLLECTION)).id;
  const ref = doc(db, COLLECTION, id);
  await setDoc(ref, {
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    projectId: input.projectId ?? null,
    projectTitle: input.projectTitle ?? null,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    date: input.date,
    status: "todo",
    report: EMPTY_REPORT,
    reports: [],
    assignedHours: input.assignedHours ?? 0,
    isOvertime: input.isOvertime ?? false,
    compensatesWeeklyHours: input.compensatesWeeklyHours ?? false,
    overtimeCost: input.overtimeCost ?? 0,
    attachments: input.attachments ?? [],
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction("Created Task", `Assigned task "${input.title}" to ${input.assigneeName}`);
  return id;
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<DailyTask, "title" | "description" | "status" | "report" | "reports" | "date">
  >,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  
  const updates = Object.keys(patch).join(", ");
  await logAdminAction("Updated Task", `Updated task (ID: ${id}) fields: ${updates}`);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
  await logAdminAction("Deleted Task", `Deleted task (ID: ${id})`);
}
