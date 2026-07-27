// Data access for the Projects database (Firestore "projects" collection).
//
// All functions run client-side (Firebase Web SDK). Security is enforced by
// firestore.rules — these helpers assume the caller is an authenticated member.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { DbColumn, DbRow, NewProject, Project, TaskItem, TaskFile } from "@/lib/data/types";
import { defaultColumns } from "@/lib/firebase/db";
import { logAdminAction } from "./logs";

const COLLECTION = "projects";

// Convert a Firestore document into a typed Project, tolerating missing fields
// from older/partial documents.
function toProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    title: (data.title as string) ?? "Untitled",
    description: (data.description as string) ?? "",
    status: (data.status as Project["status"]) ?? "backlog",
    priority: (data.priority as Project["priority"]) ?? "medium",
    assigneeUid: (data.assigneeUid as string | null) ?? null,
    teamId: (data.teamId as string | null) ?? null,
    dueDate: (data.dueDate as Timestamp | null) ?? null,
    order: (data.order as number) ?? 0,
    developerIds: (data.developerIds as string[]) ?? [],
    projectRoles: (data.projectRoles as Record<string, string>) ?? {},
    slackChannelId: (data.slackChannelId as string | undefined) ?? undefined,
    columns: (data.columns as DbColumn[]) ?? [],
    rows: (data.rows as DbRow[]) ?? [],
    tasks: (data.tasks as TaskItem[]) ?? [],
    financeFiles: (data.financeFiles as TaskFile[]) ?? [],
    createdBy: (data.createdBy as string) ?? "",
    createdAt: (data.createdAt as Timestamp | null) ?? null,
    updatedAt: (data.updatedAt as Timestamp | null) ?? null,
  };
}

// Subscribe to all projects, newest-updated first. Returns an unsubscribe fn.
export function subscribeToProjects(
  onData: (projects: Project[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toProject(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

// Subscribe to a single project by id. Calls onData(null) if it doesn't exist.
export function subscribeToProject(
  id: string,
  onData: (project: Project | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION, id),
    (snap) => onData(snap.exists() ? toProject(snap.id, snap.data()) : null),
    (err) => onError?.(err),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toProject(snap.id, snap.data()) : null;
}

// Create a project. `createdByUid` is the signed-in user's uid (the rules
// require createdBy == request.auth.uid on create).
export async function createProject(
  input: NewProject,
  createdByUid: string,
  init?: { columns?: DbColumn[]; rows?: DbRow[] },
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "backlog",
    priority: input.priority ?? "medium",
    assigneeUid: input.assigneeUid ?? null,
    teamId: input.teamId ?? null,
    dueDate: input.dueDate ?? null,
    order: Date.now(), // simple monotonically-increasing default sort key
    developerIds: [],
    projectRoles: {},
    columns: init?.columns ?? defaultColumns(),
    rows: init?.rows ?? [],
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction("Created Project", `Created project "${input.title}"`);
  return ref.id;
}

// Patch a project. Always bumps updatedAt so the list re-sorts correctly.
export async function updateProject(
  id: string,
  patch: Partial<
    Pick<
      Project,
      | "title"
      | "description"
      | "status"
      | "priority"
      | "assigneeUid"
      | "teamId"
      | "dueDate"
      | "order"
      | "developerIds"
      | "columns"
      | "rows"
      | "tasks"
      | "projectRoles"
      | "slackChannelId"
      | "financeFiles"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  
  // Create a human-readable summary of what changed
  const updates = Object.keys(patch).join(", ");
  await logAdminAction("Updated Project", `Updated project settings/status (${updates})`);
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
  await logAdminAction("Deleted Project", `Deleted project (ID: ${id})`);
}
