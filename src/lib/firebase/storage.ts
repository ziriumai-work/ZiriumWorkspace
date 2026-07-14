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
