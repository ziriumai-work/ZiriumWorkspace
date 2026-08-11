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
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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
  accessBlocked: string | null;
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
  try {
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      const newMember = {
        uid: user.uid,
        role: "member" as const,
        teamIds: [] as string[],
        createdAt: serverTimestamp(),
      };
      await setDoc(memberRef, newMember).catch((err) =>
        console.warn("Could not create member doc in Firestore:", err)
      );
      return { ...newMember, createdAt: null };
    }
    return snap.data() as Member;
  } catch (err) {
    console.warn("Fallback to in-memory member:", err);
    return {
      uid: user.uid,
      role: "member",
      teamIds: [],
      createdAt: null,
    };
  }
}

// ΓöÇΓöÇΓöÇ Setup screen messages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const SETUP_MESSAGES = [
  "Loading your workspaceΓÇª",
  "Syncing your permissionsΓÇª",
  "Preparing your dashboardΓÇª",
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

// ΓöÇΓöÇΓöÇ Provider ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  // authResolved: Firebase Auth has fired at least once (user may be null = signed out).
  const [authResolved, setAuthResolved] = useState(false);
  // memberLoaded: member doc has been fetched (or user is null).
  const [memberLoaded, setMemberLoaded] = useState(false);
  // roleSynced: the initial member Γåö employee role sync has completed.
  const [roleSynced, setRoleSynced] = useState(false);

  // ΓöÇΓöÇ 1. Auth state listener ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    let memberUnsub: (() => void) | undefined;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (memberUnsub) {
        memberUnsub();
        memberUnsub = undefined;
      }
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

        memberUnsub = onSnapshot(doc(db, "members", nextUser.uid), (snap) => {
          if (snap.exists()) {
            setMember(snap.data() as Member);
          }
        });
      } else {
        setMember(null);
        setMemberLoaded(true);
        setRoleSynced(true); // no user ΓåÆ nothing to sync
        setEmployees(null);
      }
      setAuthResolved(true);
    });
    return () => {
      unsubscribe();
      if (memberUnsub) memberUnsub();
    };
  }, []);

  // ΓöÇΓöÇ 2. Employee directory subscription ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (!user || !memberLoaded || !member) return;
    // Reset sync state on new user login
    setRoleSynced(false);
    const unsub = subscribeToDevelopers(
      (devs) => setEmployees(devs),
      (err) => console.warn("subscribeToDevelopers warning:", err),
    );
    return () => {
      unsub();
      setEmployees(null);
    };
  }, [user, memberLoaded, member]);

  // ΓöÇΓöÇ 3. Match current user to their employee record ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const employee =
    user?.email && employees
      ? (employees.find(
          (e) => e.email.trim().toLowerCase() === user.email!.trim().toLowerCase(),
        ) ?? null)
      : null;

  // ΓöÇΓöÇ 4. Bind auth uid ΓåÆ employee record on first match ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (employee && user && !employee.uid) {
      updateDeveloper(employee.id, { uid: user.uid }).catch(() => {});
    }
  }, [employee, user]);

  // ΓöÇΓöÇ 5. Sync member.role Γåö employee.accessLevel ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const syncedRolesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !member || employees === null) return;

    // Current user's role sync
    if (employee && user.uid) {
      const isEmpIntern =
        employee.accessLevel === "intern" || employee.employmentType === "intern";
      const targetRole =
        employee.accessLevel === "admin"
          ? (member.role === "owner" ? "owner" : "admin")
          : isEmpIntern
            ? "intern"
            : "employee";

      const cacheKey = `${user.uid}_${targetRole}`;
      if (!syncedRolesRef.current.has(cacheKey) && member.role !== targetRole) {
        syncedRolesRef.current.add(cacheKey);
        // Update local state immediately in memory so UI reflects the correct role
        setMember((prev) => prev ? { ...prev, role: targetRole } : prev);
        // Sync role to Firestore
        updateMemberRole(user.uid, targetRole).catch(() => {});
      }
    }

    // Mark role as synced ΓÇö this unblocks the loading gate.
    setRoleSynced(true);

    // Admin: batch-sync all employees' member roles in Firestore
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

  // ΓöÇΓöÇ 6. Compute loading ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // loading stays true until auth is resolved, member is loaded, employees
  // have loaded, AND the initial role sync has completed.
  const loading = !authResolved || (!!user && (!memberLoaded || employees === null || !roleSynced));

  // ΓöÇΓöÇ 7. Access check (offboarded / terminated / unregistered) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const isPrivileged = member?.role === "owner" || member?.role === "admin";
  const accessBlocked: string | null =
    !user || loading || employees === null || !member
      ? null
      : employee
        ? employee.status === "terminated" || employee.status === "offboarded"
          ? "Your account access has been revoked. If you believe this is an error, please contact your administrator."
          : null
        : !isPrivileged
          ? "Your email is not registered in the system. Please contact your administrator to be added before logging in or registering."
          : null;

  // ΓöÇΓöÇ 8. Role resolution ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const isAdmin = employee
    ? employee.accessLevel === "admin" || member?.role === "owner"
    : employees !== null && (
        member?.role === "owner" || member?.role === "admin"
      );

  const isIntern =
    employee?.accessLevel === "intern" ||
    employee?.employmentType === "intern" ||
    member?.role === "intern";

  const role: AppRole | null =
    !user || employees === null
      ? null
      : isAdmin
        ? "admin"
        : employee
          ? isIntern
            ? "intern"
            : "employee"
          : null;

  // ΓöÇΓöÇ Auth actions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

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

  // ΓöÇΓöÇ Render gates ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  // Access denied screen (offboarded / terminated / unregistered)
  if (accessBlocked) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', p: 3, bgcolor: "background.default" }}>
        <Typography variant="h4" color="error" sx={{ fontWeight: 700, mb: 2 }}>Access Denied</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>{accessBlocked}</Typography>
        <Button 
          variant="contained" 
          onClick={async () => { 
            await firebaseSignOut(auth).catch(() => {});
            window.location.href = '/login'; 
          }}
          sx={{ borderRadius: 2 }}
        >
          Return to Login
        </Button>
      </Box>
    );
  }

  // First-time setup screen: shown ONLY when a user is signing in for the very first time
  // (i.e. their employee profile has not yet been bound to their auth UID: !employee.uid).
  // Established users whose accounts are already bound never see this screen on future logins.
  if (user && loading && authResolved && memberLoaded && (!employee || !employee.uid)) {
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
        accessBlocked,
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
