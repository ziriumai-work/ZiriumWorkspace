// Data access for EMPLOYEES (Firestore collection "developers" — name kept for
// backwards-compat). Client-side; access is gated by firestore.rules (members).
// Admin-only management is enforced in the UI (see useAuth().isAdmin).

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
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  Developer,
  Department,
  EmploymentType,
  EmployeeStatus,
  AccessLevel,
} from "@/lib/data/types";

const COLLECTION = "developers";

function toDeveloper(id: string, data: Record<string, unknown>): Developer {
  return {
    id,
    name: (data.name as string) ?? "",
    email: (data.email as string) ?? "",
    role: (data.role as string) ?? "",
    department: (data.department as Department) ?? "custom",
    employmentType: (data.employmentType as EmploymentType) ?? "full_time",
    startDate: (data.startDate as string | null) ?? null,
    status: (data.status as EmployeeStatus) ?? "active",
    accessLevel: (data.accessLevel as AccessLevel) ?? "employee",
    uid: (data.uid as string | null) ?? null,
    createdAt: (data.createdAt as Timestamp | null) ?? null,
  };
}

// Subscribe to the employee directory, alphabetical by name.
export function subscribeToDevelopers(
  onData: (devs: Developer[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLLECTION), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toDeveloper(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

// What an admin supplies when adding an employee.
export type NewEmployee = {
  name: string;
  email: string;
  role?: string;
  department?: Department;
  employmentType?: EmploymentType;
  startDate?: string | null;
  status?: EmployeeStatus;
  accessLevel?: AccessLevel;
};

export async function addDeveloper(input: NewEmployee): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role?.trim() ?? "",
    department: input.department ?? "custom",
    employmentType: input.employmentType ?? "full_time",
    startDate: input.startDate ?? null,
    status: input.status ?? "active",
    accessLevel: input.accessLevel ?? "employee",
    uid: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDeveloper(
  id: string,
  patch: Partial<Omit<Developer, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), patch);
}

export async function deleteDeveloper(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
