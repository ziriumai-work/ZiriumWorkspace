import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  limit,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import type { AdminLog } from "./types";

/**
 * Reusable helper to log an action performed by an admin.
 * Pulls the current user directly from Firebase Auth.
 * Falls back to "Unknown Admin" if details can't be found.
 */
export async function logAdminAction(action: string, details: string) {
  if (!auth.currentUser) return; // Silent return if no authenticated user
  const uid = auth.currentUser.uid;
  
  let adminName = auth.currentUser.displayName || "Unknown Admin";
  let adminPhotoUrl = auth.currentUser.photoURL || null;
  
  try {
    // Attempt to enrich with the main users profile (if it has better data)
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      adminName = data.displayName || adminName;
      adminPhotoUrl = data.photoURL || adminPhotoUrl;
    }
  } catch (err) {
    console.warn("Could not fetch user profile for log:", err);
  }

  try {
    await addDoc(collection(db, "admin_logs"), {
      adminId: uid,
      adminName,
      adminPhotoUrl,
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write admin log:", err);
  }
}

/**
 * Subscribes to the 1000 most recent admin logs.
 */
export function subscribeToLogs(
  callback: (logs: AdminLog[]) => void,
  maxLogs = 1000
) {
  const q = query(
    collection(db, "admin_logs"),
    orderBy("timestamp", "desc"),
    limit(maxLogs)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AdminLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          adminId: data.adminId,
          adminName: data.adminName,
          adminPhotoUrl: data.adminPhotoUrl,
          action: data.action,
          details: data.details,
          timestamp: data.timestamp,
        });
      });
      callback(logs);
    },
    (error) => {
      console.error("Error subscribing to admin logs:", error);
      callback([]);
    }
  );
}
