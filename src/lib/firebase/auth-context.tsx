"use client";

// AuthProvider: the single source of truth for "who is signed in" across the
// app. It also ensures a user's profile + company membership documents exist on
// first sign-in (self-join as a plain 'member' — see firestore.rules).
//
// React Context can't live in a Server Component, so this whole module is a
// Client Component ("use client").

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { subscribeToDevelopers, updateDeveloper } from "@/lib/data/developers";
import type { AppRole, Employee, Member } from "@/lib/data/types";

interface AuthState {
  user: User | null; // Firebase Auth user (null = signed out)
  member: Member | null; // company membership + role (null = not loaded / not a member yet)
  employee: Employee | null; // matching employee record (by email), if any
  isAdmin: boolean; // can manage employees/projects/tasks (UI gate)
  // Resolved app role — what routing and nav key off. Stays null until the
  // employee directory has loaded, so redirects never fire on a half-resolved
  // state (e.g. sending an intern to the admin dashboard for a frame).
  role: AppRole | null;
  loading: boolean; // true until the first auth state resolves
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Create the profile + membership docs the first time we see a user.
async function ensureUserDocs(user: User): Promise<Member> {
  // Profile (merge so we refresh name/photo on every sign-in).
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  // Membership: create once as a plain 'member' if it doesn't exist yet.
  const memberRef = doc(db, "members", user.uid);
  const snap = await getDoc(memberRef);
  if (!snap.exists()) {
    const newMember = {
      uid: user.uid,
      role: "member" as const,
      teamIds: [] as string[],
      createdAt: serverTimestamp(),
    };
    await setDoc(memberRef, newMember);
    return { ...newMember, createdAt: null };
  }
  return snap.data() as Member;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        try {
          setMember(await ensureUserDocs(nextUser));
        } catch (err) {
          console.error("Failed to load membership", err);
          setMember(null);
        }
      } else {
        setMember(null);
      }
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Load the employee directory once signed in, so we can resolve the current
  // user's employee record (matched by email) and their access level.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToDevelopers(setEmployees, () => setEmployees([]));
    return () => {
      unsub();
      setEmployees(null);
    };
  }, [user]);

  // The employee record matching the signed-in email.
  const employee =
    user?.email && employees
      ? (employees.find(
          (e) => e.email.toLowerCase() === user.email!.toLowerCase(),
        ) ?? null)
      : null;

  // Bind the auth uid to the employee record on first match (best-effort).
  useEffect(() => {
    if (employee && user && !employee.uid) {
      updateDeveloper(employee.id, { uid: user.uid }).catch(() => {});
    }
  }, [employee, user]);

  // Admin if EITHER:
  //  - a privileged member role, OR
  //  - listed in the employee directory with accessLevel "admin", OR
  //  - signed in but NOT yet in the employee directory at all (the owner / setup
  //    accounts). Only people explicitly added as employees get the restricted
  //    view — this prevents locking the owner out of their own workspace.
  const isAdmin =
    member?.role === "owner" ||
    member?.role === "admin" ||
    employee?.accessLevel === "admin" ||
    (user !== null && employees !== null && employee === null);

  // Resolve the app role once the directory is available. Interns are marked
  // by their employee record's accessLevel; everyone else in the directory is
  // an employee unless one of the admin conditions above applies.
  const role: AppRole | null =
    !user || employees === null
      ? null
      : isAdmin
        ? "admin"
        : employee?.accessLevel === "intern"
          ? "intern"
          : "employee";

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        member,
        employee,
        isAdmin,
        role,
        loading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
