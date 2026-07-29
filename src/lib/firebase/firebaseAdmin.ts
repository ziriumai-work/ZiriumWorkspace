// Server-only Firebase Admin SDK — used by API routes to verify ID tokens.
// Gracefully handles missing FIREBASE_PRIVATE_KEY so the module never crashes on import.

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
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores multiline values with literal \n — unescape them back to real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (keyJson) {
    try {
      const serviceAccount = JSON.parse(keyJson);
      if (typeof serviceAccount.private_key === "string") {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      return adminApp;
    } catch {
      // JSON parsing failed — fall through to individual key approach.
    }
  }

  if (clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
      return adminApp;
    } catch {
      // Credential init failed — fall back to project-ID-only (token verification will use REST fallback).
    }
  }

  // No credentials available — initialize with projectId only.
  // Token verification in API routes will fall back to the Google Identity Toolkit REST API.
  adminApp = initializeApp({ projectId });
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
