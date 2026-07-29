"use client";

// AuthProvider: global state management for Firebase user auth & membership roles.
// On first login, shows a "Setting up your account" screen with rotating messages
// until all data (member + employees + role sync) is ready.

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
import CircularProgress from "@mui/material/CircularProgress";
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
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { subscribeToDevelopers, updateDeveloper } from "@/lib/data/developers";
import { updateMemberRole } from "@/lib/data/members";
import type { AppRole, Employee, Member } from "@/lib/data/types";

interface AuthState {
  user: User | null;
  member: Member | null;
  employee: Employee | null;
  isAdmin: boolean;
  role: AppRole | null;
  loading: boolean; // true until auth + member + employees are ALL resolved
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

// ─── Setup screen messages ────────────────────────────────────────────────────
const SETUP_MESSAGES = [
  "Setting up your account…",
  "Please wait a few moments…",
  "One-time setup, almost done…",
];

function SetupScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % SETUP_MESSAGES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        bgcolor: "background.default",
        gap: 3,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(25,118,210,0.3)",
          animation: "pulse 2s ease-in-out infinite",
          "@keyframes pulse": {
            "0%, 100%": { transform: "scale(1)", opacity: 1 },
            "50%": { transform: "scale(1.08)", opacity: 0.85 },
          },
        }}
      >
        <CircularProgress size={28} sx={{ color: "white" }} />
      </Box>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: "text.primary",
          transition: "opacity 0.4s ease",
        }}
        key={msgIdx}
      >
        {SETUP_MESSAGES[msgIdx]}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This only happens on your first sign-in.
      </Typography>
    </Box>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  // authResolved: Firebase Auth has fired at least once (user may be null = signed out).
  const [authResolved, setAuthResolved] = useState(false);
  // memberLoaded: member doc has been fetched (or user is null).
  const [memberLoaded, setMemberLoaded] = useState(false);
  // roleSynced: the initial member ↔ employee role sync has completed.
  const [roleSynced, setRoleSynced] = useState(false);

  // ── 1. Auth state listener ────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        syncUserProfile(nextUser);
        try {
          const m = await fetchOrCreateMember(nextUser);
          setMember(m);
        } catch (err) {
          console.error("Failed to load membership", err);
          setMember(null);
        }
        setMemberLoaded(true);
      } else {
        setMember(null);
        setMemberLoaded(true);
        setRoleSynced(true); // no user → nothing to sync
        setEmployees(null);
      }
      setAuthResolved(true);
    });
    return unsubscribe;
  }, []);

  // ── 2. Employee directory subscription ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    // Reset sync state on new user login
    setRoleSynced(false);
    const unsub = subscribeToDevelopers(setEmployees, () => setEmployees([]));
    return () => {
      unsub();
      setEmployees(null);
    };
  }, [user]);

  // ── 3. Match current user to their employee record ────────────────────────
  const employee =
    user?.email && employees
      ? (employees.find(
          (e) => e.email.toLowerCase() === user.email!.toLowerCase(),
        ) ?? null)
      : null;

  // ── 4. Bind auth uid → employee record on first match ─────────────────────
  useEffect(() => {
    if (employee && user && !employee.uid) {
      updateDeveloper(employee.id, { uid: user.uid }).catch(() => {});
    }
  }, [employee, user]);

  // ── 5. Sync member.role ↔ employee.accessLevel ────────────────────────────
  // This is the critical step: on first login the member has role="member" which
  // is wrong. We must update it to match the employee's accessLevel BEFORE the
  // app renders, and set roleSynced=true only after this is done.
  const syncedRolesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !member || employees === null) return;

    // Current user's role sync
    if (employee && user.uid) {
      const targetRole =
        employee.accessLevel === "admin"
          ? (member.role === "owner" ? "owner" : "admin")
          : employee.accessLevel;
      const cacheKey = `${user.uid}_${targetRole}`;
      if (!syncedRolesRef.current.has(cacheKey) && member.role !== targetRole) {
        syncedRolesRef.current.add(cacheKey);
        // Update local state immediately — don't wait for Firestore round-trip.
        setMember((prev) => prev ? { ...prev, role: targetRole } : prev);
        updateMemberRole(user.uid, targetRole).catch(() => {});
      }
    }

    // Mark role as synced — this unblocks the loading gate.
    setRoleSynced(true);

    // Admin: batch-sync all employees' member roles
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

  // ── 6. Compute loading ────────────────────────────────────────────────────
  // loading stays true until auth is resolved, member is loaded, employees
  // have loaded, AND the initial role sync has completed.
  const loading = !authResolved || (!!user && (!memberLoaded || employees === null || !roleSynced));

  // ── 7. Access check (offboarded / terminated / unregistered) ──────────────
  const [accessBlocked, setAccessBlocked] = useState<string | null>(null);
  useEffect(() => {
    // Only run when everything is fully loaded
    if (loading || !user || !employees || !member) {
      // Clear any stale access block when user signs out or data resets
      if (!user && accessBlocked) setAccessBlocked(null);
      return;
    }

    const isPrivileged = member.role === "owner" || member.role === "admin";

    if (employee) {
      if (employee.status === "terminated" || employee.status === "offboarded") {
        setAccessBlocked(
          "Your account access has been revoked. If you believe this is an error, please contact your administrator."
        );
        firebaseSignOut(auth).catch(() => {});
        return;
      }
      // Employee is active and found — clear any stale block
      if (accessBlocked) setAccessBlocked(null);
    } else if (employees.length > 0 && !isPrivileged) {
      setAccessBlocked(
        "Your email is not registered in the system. Please contact your administrator to be added before logging in or registering."
      );
      firebaseSignOut(auth).catch(() => {});
    } else {
      // Clear block (e.g., admin without employee record)
      if (accessBlocked) setAccessBlocked(null);
    }
  }, [loading, user, employee, employees, member, accessBlocked]);

  // ── 8. Role resolution ────────────────────────────────────────────────────
  const isAdmin = employee
    ? employee.accessLevel === "admin" || member?.role === "owner"
    : employees !== null && (
        member?.role === "owner" || member?.role === "admin"
      );

  const role: AppRole | null =
    !user || employees === null
      ? null
      : isAdmin
        ? "admin"
        : employee?.accessLevel === "intern" || member?.role === "intern"
          ? "intern"
          : "employee";

  // ── Auth actions ──────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    setAccessBlocked(null); // clear stale blocks before new login
    await signInWithPopup(auth, googleProvider);
  }

  async function signInWithEmail(email: string, password: string) {
    setAccessBlocked(null);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUpWithEmail(name: string, email: string, password: string) {
    setAccessBlocked(null);
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
    setAccessBlocked(null);
    await firebaseSignOut(auth);
  }

  // ── Render gates ──────────────────────────────────────────────────────────

  // Access denied screen (offboarded / terminated / unregistered)
  if (accessBlocked) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', p: 3, bgcolor: "background.default" }}>
        <Typography variant="h4" color="error" sx={{ fontWeight: 700, mb: 2 }}>Access Denied</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>{accessBlocked}</Typography>
        <Button 
          variant="contained" 
          onClick={() => { setAccessBlocked(null); window.location.href = '/login'; }}
          sx={{ borderRadius: 2 }}
        >
          Return to Login
        </Button>
      </Box>
    );
  }

  // First-time setup screen: shown when user is signed in but data is still loading
  if (user && loading && authResolved && memberLoaded) {
    return <SetupScreen />;
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
