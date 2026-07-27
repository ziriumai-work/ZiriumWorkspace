// Firebase client SDK initialization.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";

const useEmulator =
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";

const firebaseConfig = {
  // With the emulator, real credentials aren't needed — fall back to harmless
  // placeholders so getAuth() doesn't reject an empty key.
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    (useEmulator ? "demo-api-key" : undefined),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (useEmulator ? "demo-workspace" : undefined),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Reuse the existing app during hot-reload / multiple imports.
export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// getAuth()/getFirestore() throw on an empty/invalid apiKey. During a server
// prerender without env vars (e.g. CI builds) that would crash the build, even
// though these services are only ever *used* in the browser. So we initialize
// eagerly in the browser and whenever a key is configured, and skip otherwise.
// The casts keep the public type clean for the client code that consumes them.
const isBrowser = typeof window !== "undefined";
const canInit = isBrowser || Boolean(firebaseConfig.apiKey);

function initFirestore(app: FirebaseApp): Firestore {
  if (!isBrowser) return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const auth: Auth = canInit
  ? getAuth(firebaseApp)
  : (undefined as unknown as Auth);
export const db: Firestore = canInit
  ? initFirestore(firebaseApp)
  : (undefined as unknown as Firestore);
export const storage: FirebaseStorage = canInit
  ? getStorage(firebaseApp)
  : (undefined as unknown as FirebaseStorage);
export const functions: Functions = canInit
  ? getFunctions(firebaseApp)
  : (undefined as unknown as Functions);

// Local development against the Firebase emulators (see firebase.json). Set
// NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true in .env.local to develop without a real
// Firebase project. Guarded so we only connect once, in the browser.
if (
  isBrowser &&
  useEmulator &&
  // @ts-expect-error — custom flag we set after the first connection
  !globalThis.__FIREBASE_EMULATORS_CONNECTED__
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  // @ts-expect-error — see above
  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true;
}

// Restrict Google sign-in to your company domain in production via the Firebase
// console (Authentication -> Settings -> Authorized domains) and/or by checking
// the email domain in the AuthProvider.
export const googleProvider = new GoogleAuthProvider();
