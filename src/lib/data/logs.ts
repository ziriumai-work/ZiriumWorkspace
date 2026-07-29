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

export async function logAdminAction(action: string, details: string) {
  if (!auth.currentUser) return; // Silent return if no authenticated user
  const uid = auth.currentUser.uid;
  const email = (auth.currentUser.email || "").toLowerCase();
  const isOwnerOrAdminEmail =
    email === "haseeb.a@ziriumai.com" ||
    email === "haseeb.a@zirium.com" ||
    email === "ziriumai@gmail.com";

  try {
    const memberSnap = await getDoc(doc(db, "members", uid));
    if (memberSnap.exists()) {
      const role = memberSnap.data()?.role;
      if (role !== "owner" && role !== "admin" && !isOwnerOrAdminEmail) {
        // Silent return: Do not record employee/intern actions in admin logs
        return;
      }
    } else if (!isOwnerOrAdminEmail) {
      return;
    }
  } catch (err) {
    if (!isOwnerOrAdminEmail) return;
  }
  
  let adminName = auth.currentUser.displayName || auth.currentUser.email || "System Admin";
  let adminPhotoUrl = auth.currentUser.photoURL || null;
  
  try {
    // Attempt to enrich with the main users profile (if it has better data)
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      adminName = data.displayName || adminName || auth.currentUser.email || "System Admin";
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
          adminId: data.adminId || "",
          adminName: data.adminName || "System Admin",
          adminPhotoUrl: data.adminPhotoUrl || null,
          action: data.action || "Admin Action",
          details: data.details || "",
          timestamp: data.timestamp || null,
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
