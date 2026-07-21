// File uploads for task reports, backed by Firebase Storage.
// Requires Storage to be enabled in the Firebase console (Build → Storage) and
// storage.rules published. Until then, uploads throw a helpful error.

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import type { TaskFile } from "@/lib/data/types";

// Upload a file under a task and return its name + public download URL.
export async function uploadTaskFile(
  taskId: string,
  file: File,
): Promise<TaskFile> {
  // Prefix with a timestamp to avoid name collisions within a task.
  const path = `task-reports/${taskId}/${Date.now()}-${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { name: file.name, url };
}

export async function uploadDocumentFile(
  docId: string,
  file: File,
): Promise<TaskFile> {
  const path = `documents/${docId}/${Date.now()}-${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { name: file.name, url };
}

export async function uploadFinanceProjectFile(
  projectId: string,
  file: File,
): Promise<TaskFile> {
  const path = `financeProjects/${projectId}/${Date.now()}-${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { name: file.name, url };
}
export async function uploadLeaveProof(
  uid: string,
  file: File,
): Promise<TaskFile> {
  const path = `leaveRequests/${uid}/${Date.now()}-${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { name: file.name, url };
}

export async function uploadProfilePhoto(
  uid: string,
  file: Blob | File,
): Promise<string> {
  const path = `profiles/${uid}/avatar-${Date.now()}.png`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}
