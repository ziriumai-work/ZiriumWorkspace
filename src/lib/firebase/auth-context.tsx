"use client";

// AuthProvider: global state management for Firebase user auth & membership roles.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { subscribeToDevelopers, updateDeveloper } from "@/lib/data/developers";
import { updateMemberRole } from "@/lib/data/members";
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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Non-blocking profile sync in the background so it never slows down login/boot.
function syncUserProfile(user: User): void {
  setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  ).catch((err) => console.error("Profile sync failed:", err));
}

// Membership: read immediately (served instantly from local cache if available).
async function fetchOrCreateMember(user: User): Promise<Member> {
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
      // 1. Set auth user immediately so dependent subscriptions fire in parallel without delay!
      setUser(nextUser);
      if (nextUser) {
        // 2. Fire off profile write asynchronously in background
        syncUserProfile(nextUser);

        // 3. Fetch membership (instant from IndexedDB cache when available)
        try {
          const m = await fetchOrCreateMember(nextUser);
          setMember(m);
        } catch (err) {
          console.error("Failed to load membership", err);
          setMember(null);
        }
      } else {
        setMember(null);
      }
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

  // Automatically sync employee.accessLevel with members.role
  const syncedRolesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !member || !employees) return;

    // Always sync current logged in user's member role to match their employee.accessLevel
    if (employee && user.uid) {
      const targetRole =
        employee.accessLevel === "admin"
          ? (member.role === "owner" ? "owner" : "admin")
          : employee.accessLevel;
      const cacheKey = `${user.uid}_${targetRole}`;
      if (!syncedRolesRef.current.has(cacheKey) && member.role !== targetRole) {
        syncedRolesRef.current.add(cacheKey);
        // Immediately update local state so UI reflects the correct role
        // without waiting for the Firestore round-trip + page refresh.
        setMember((prev) => prev ? { ...prev, role: targetRole } : prev);
        updateMemberRole(user.uid, targetRole).catch(() => {});
      }
    }

    const isPrivileged = member.role === "owner" || member.role === "admin";
    if (isPrivileged) {
      employees.forEach((emp) => {
        if (!emp.uid) return;
        const targetRole =
          emp.accessLevel === "admin" ? "admin" : emp.accessLevel;
        const cacheKey = `${emp.uid}_${targetRole}`;
        if (!syncedRolesRef.current.has(cacheKey)) {
          syncedRolesRef.current.add(cacheKey);
          updateMemberRole(emp.uid, targetRole).catch(() => {});
        }
      });
    }
  }, [user, member, employee, employees]);

  const [accessBlocked, setAccessBlocked] = useState<string | null>(null);

  // Check for unauthorized access or turnover statuses
  useEffect(() => {
    if (!loading && user && employees && member) {
      const isPrivileged = member.role === "owner" || member.role === "admin";
      if (employee) {
        if (employee.status === "terminated" || employee.status === "offboarded") {
          setAccessBlocked("Your account access has been revoked. If you believe this is an error, please contact your administrator.");
          firebaseSignOut(auth).catch(() => {});
        }
      } else if (employees.length > 0 && !isPrivileged) {
        // Not in the system, but system has users (so this is not the very first setup owner)
        // And they are not manually promoted to owner/admin in the members collection.
        setAccessBlocked("Your email is not registered in the system. Please contact your administrator to be added before logging in or registering.");
        firebaseSignOut(auth).catch(() => {});
      }
    }
  }, [loading, user, employee, employees, member]);

  // isAdmin resolution — checks employee.accessLevel and member.role.
  const isAdmin = employee
    ? employee.accessLevel === "admin" || member?.role === "owner"
    : employees !== null && (
        member?.role === "owner" || member?.role === "admin"
      );

  // Resolve the app role once the directory is available.
  const role: AppRole | null =
    !user || employees === null
      ? null
      : isAdmin
        ? "admin"
        : employee?.accessLevel === "intern" || member?.role === "intern"
          ? "intern"
          : "employee";

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  // Create an email/password account. Sets the display name so the workspace
  // greets the user properly; profile + membership docs are created by the
  // same onAuthStateChanged flow Google sign-in uses.
  async function signUpWithEmail(name: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = name.trim();
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  if (accessBlocked) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', p: 3, bgcolor: "background.default" }}>
        <Typography variant="h4" color="error" sx={{ fontWeight: 700, mb: 2 }}>Access Denied</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>{accessBlocked}</Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.href = '/login'}
          sx={{ borderRadius: 2 }}
        >
          Return to Login
        </Button>
      </Box>
    );
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
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
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
