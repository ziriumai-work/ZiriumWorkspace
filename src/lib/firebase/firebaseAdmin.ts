// Server-only Firebase Admin SDK initializer.
// Used by API routes (e.g. /api/ai) to verify Firebase ID tokens.
// This file must NEVER be imported from client-side code.

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
  }

  // If a service account key JSON string is provided, use it.
  // Otherwise fall back to Application Default Credentials (works on
  // Cloud Run, App Hosting, and local emulators with GOOGLE_APPLICATION_CREDENTIALS).
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      const serviceAccount = JSON.parse(keyJson);
      adminApp = initializeApp({ credential: cert(serviceAccount) });
    } catch {
      // If parsing fails, fall back to ADC.
      adminApp = initializeApp();
    }
  } else {
    adminApp = initializeApp();
  }
  return adminApp;
}

/** Lazily initialised Firebase Admin Auth instance. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
