// Server-only Firebase Admin SDK initializer.
// Used by API routes (e.g. /api/ai) to verify Firebase ID tokens.
// This file must NEVER be imported from client-side code.

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    "ziriumai-workspace-5c840";

  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      const serviceAccount = JSON.parse(keyJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
    } catch {
      // If parsing fails, fall back to ADC.
      adminApp = initializeApp({ projectId });
    }
  } else {
    adminApp = initializeApp({ projectId });
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
