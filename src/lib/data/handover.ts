// Database handover & reset utility.
// Cleanly wipes all employee/intern records, attendance, tasks, projects,
// finances, and logs, preserving ONLY the designated admin account.

import {
  collection,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import type { Developer } from "@/lib/data/types";

export interface HandoverResetResult {
  keptAdminEmail: string;
  keptAdminUid: string | null;
  deletedCounts: Record<string, number>;
}

const COLLECTIONS_TO_WIPE_ENTIRELY = [
  "attendance",
  "leaveRequests",
  "admin_logs",
  "announcements",
  "tasks",
  "projects",
  "salaries",
  "financeProjects",
  "invoices",
  "allotments",
  "monthlyExpenses",
  "documents",
  "teams",
];

/**
 * Resets the entire Firestore database cleanly for company handover,
 * retaining ONLY the admin account with the specified email (default: haseeb.a@zirium.com).
 */
export async function resetWorkspaceForHandover(
  targetAdminEmail: string = "haseeb.a@ziriumai.com",
  onProgress?: (step: string) => void
): Promise<HandoverResetResult> {
  const normalizedEmail = targetAdminEmail.trim().toLowerCase();
  const deletedCounts: Record<string, number> = {};

  onProgress?.(`Locating admin account ${normalizedEmail} in /developers...`);

  // 1. Inspect /developers and identify the target admin to keep
  const devSnap = await getDocs(collection(db, "developers"));
  let keptDevId: string | null = null;
  let keptDevUid: string | null = null;
  let devDeleteCount = 0;

  for (const d of devSnap.docs) {
    const data = d.data();
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (email === normalizedEmail) {
      keptDevId = d.id;
      keptDevUid = (data.uid as string) || null;
    }
  }

  // Fallback: If UID isn't stamped on developer doc yet, match against current logged-in user
  if (!keptDevUid && auth.currentUser?.email?.toLowerCase() === normalizedEmail) {
    keptDevUid = auth.currentUser.uid;
  }

  if (!keptDevId) {
    throw new Error(
      `Cannot reset workspace: Admin account "${targetAdminEmail}" was not found in the developers directory. Please ensure it exists before running handover cleanup.`
    );
  }

  // 2. Delete all other developer accounts
  onProgress?.(`Cleaning /developers directory (preserving ${normalizedEmail})...`);
  for (const d of devSnap.docs) {
    if (d.id !== keptDevId) {
      await deleteDoc(d.ref);
      devDeleteCount++;
    }
  }
  deletedCounts["developers"] = devDeleteCount;

  // 3. Delete all other membership docs in /members
  onProgress?.(`Cleaning /members roles...`);
  const memberSnap = await getDocs(collection(db, "members"));
  let memberDeleteCount = 0;
  for (const m of memberSnap.docs) {
    // Keep only the UID of the target admin
    if (!keptDevUid || m.id !== keptDevUid) {
      await deleteDoc(m.ref);
      memberDeleteCount++;
    }
  }
  deletedCounts["members"] = memberDeleteCount;

  // 4. Delete all other user profiles in /users
  onProgress?.(`Cleaning /users profiles...`);
  try {
    const userSnap = await getDocs(collection(db, "users"));
    let userDeleteCount = 0;
    for (const u of userSnap.docs) {
      if (!keptDevUid || u.id !== keptDevUid) {
        await deleteDoc(u.ref);
        userDeleteCount++;
      }
    }
    deletedCounts["users"] = userDeleteCount;
  } catch (err) {
    console.warn("Could not clean /users:", err);
    deletedCounts["users"] = 0;
  }

  // 5. Wipe all operational collections completely
  for (const colName of COLLECTIONS_TO_WIPE_ENTIRELY) {
    onProgress?.(`Wiping collection /${colName}...`);
    try {
      const snap = await getDocs(collection(db, colName));
      let count = 0;
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        count++;
      }
      deletedCounts[colName] = count;
    } catch (err) {
      console.warn(`Could not clear collection ${colName}:`, err);
      deletedCounts[colName] = 0;
    }
  }

  // 5. Log the handover event in admin_logs as the fresh first log
  onProgress?.(`Creating handover audit log...`);
  await addDoc(collection(db, "admin_logs"), {
    action: "Workspace Handover Reset",
    details: `Cleanly reset all employee, intern, project, finance, and attendance records. Preserved admin account "${targetAdminEmail}".`,
    timestamp: serverTimestamp(),
  });

  onProgress?.(`Completed! Workspace is fresh and ready for handover.`);

  return {
    keptAdminEmail: targetAdminEmail,
    keptAdminUid: keptDevUid,
    deletedCounts,
  };
}
