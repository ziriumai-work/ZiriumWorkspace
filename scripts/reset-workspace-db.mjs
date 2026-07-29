// Standalone Node.js CLI Script for Zirium Workspace Handover Reset
// Usage: node scripts/reset-workspace-db.mjs <admin_email> <admin_password>
// Default email: haseeb.a@zirium.com

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, "../.env.local") });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const TARGET_ADMIN_EMAIL = process.argv[2] || "haseeb.a@zirium.com";
const TARGET_ADMIN_PASSWORD = process.argv[3];

const COLLECTIONS_TO_WIPE = [
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

async function runReset() {
  console.log("==========================================");
  console.log("   ZIRIUM WORKSPACE HANDOVER DB RESET     ");
  console.log("==========================================");
  console.log(`Target Admin to retain: ${TARGET_ADMIN_EMAIL}`);

  if (!TARGET_ADMIN_PASSWORD) {
    console.error(
      "ERROR: Please provide the password for the admin account as the second argument:"
    );
    console.error(
      "Usage: node scripts/reset-workspace-db.mjs haseeb.a@zirium.com <password>"
    );
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    console.log(`\n[1/5] Signing in as ${TARGET_ADMIN_EMAIL}...`);
    await signInWithEmailAndPassword(
      auth,
      TARGET_ADMIN_EMAIL,
      TARGET_ADMIN_PASSWORD
    );
    console.log("✓ Signed in successfully as Admin.");

    console.log(`\n[2/5] Inspecting /developers collection...`);
    const devSnap = await getDocs(collection(db, "developers"));
    let keptDevId = null;
    let keptDevUid = null;
    let deletedDevs = 0;

    for (const d of devSnap.docs) {
      const data = d.data();
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      if (email === TARGET_ADMIN_EMAIL.trim().toLowerCase()) {
        keptDevId = d.id;
        keptDevUid = data.uid || null;
      }
    }

    if (!keptDevId) {
      throw new Error(
        `Admin account "${TARGET_ADMIN_EMAIL}" not found in /developers! Aborting clean.`
      );
    }

    for (const d of devSnap.docs) {
      if (d.id !== keptDevId) {
        await deleteDoc(d.ref);
        deletedDevs++;
      }
    }
    console.log(
      `✓ Cleaned /developers: Kept ${TARGET_ADMIN_EMAIL}, deleted ${deletedDevs} other records.`
    );

    console.log(`\n[3/5] Inspecting /members roles...`);
    const memberSnap = await getDocs(collection(db, "members"));
    let deletedMembers = 0;
    for (const m of memberSnap.docs) {
      if (!keptDevUid || m.id !== keptDevUid) {
        await deleteDoc(m.ref);
        deletedMembers++;
      }
    }
    console.log(`✓ Cleaned /members: deleted ${deletedMembers} other records.`);

    console.log(`\n[4/5] Cleaning /users profiles...`);
    try {
      const userSnap = await getDocs(collection(db, "users"));
      let deletedUsers = 0;
      for (const u of userSnap.docs) {
        if (!keptDevUid || u.id !== keptDevUid) {
          await deleteDoc(u.ref);
          deletedUsers++;
        }
      }
      console.log(`✓ Cleaned /users: deleted ${deletedUsers} other records.`);
    } catch (err) {
      console.warn("Could not clean /users:", err);
    }

    console.log(`\n[5/5] Wiping operational & historical collections...`);
    for (const col of COLLECTIONS_TO_WIPE) {
      const snap = await getDocs(collection(db, col));
      let count = 0;
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        count++;
      }
      console.log(`  - /${col}: deleted ${count} documents.`);
    }

    console.log(`\n[5/5] Recording fresh audit log...`);
    await addDoc(collection(db, "admin_logs"), {
      action: "Workspace Handover Reset (CLI)",
      details: `Cleaned all employee/intern records, tasks, projects, finances, and attendance. Retained only ${TARGET_ADMIN_EMAIL}.`,
      timestamp: serverTimestamp(),
    });

    console.log("\n==========================================");
    console.log(" 🎉 SUCCESS! Workspace DB cleanly reset.");
    console.log(`    Only ${TARGET_ADMIN_EMAIL} remains.`);
    console.log("==========================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\nERROR during reset:", err);
    process.exit(1);
  }
}

runReset();
