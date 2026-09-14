"use client";

// Global auth state: Firebase user, member role, and employee record.
// Shows a setup screen on first login until role sync completes.

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

// Non-blocking background sync of the Firebase user profile document.
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

// Reads the member doc or creates one on first sign-in.
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
      await setDoc(memberRef, newMember);
      return newMember as unknown as Member;
    }
    return snap.data() as Member;
  } catch (err) {
    console.warn("Could not load member doc:", err);
    throw err;
  }
}


const SETUP_MESSAGES = [
  "Loading your workspace…",
  "Syncing your permissions…",
  "Preparing your dashboard…",
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

  // 1. Auth state listener
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
          let m = await fetchOrCreateMember(nextUser);
          // Ensure owner emails always have the 'owner' role.
          if (m && m.role === "member" && nextUser.email) {
            const ownerEmails = ["haseeb.a@ziriumai.com", "haseeb.a@zirium.com", "ziriumai@gmail.com"];
            if (ownerEmails.includes(nextUser.email.trim().toLowerCase())) {
              const memberRef = doc(db, "members", nextUser.uid);
              await setDoc(memberRef, {
                role: "owner" as const,
              }, { merge: true }).catch(() => {});
              m = { uid: nextUser.uid, role: "owner", teamIds: [], createdAt: null };
            }
          }
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
        setRoleSynced(true); // no user → nothing to sync
        setEmployees(null);
      }
      setAuthResolved(true);
    });
    return () => {
      unsubscribe();
      if (memberUnsub) memberUnsub();
    };
  }, []);

  // 2. Subscribe to employee directory.
  useEffect(() => {
    if (!user || !memberLoaded) return;
    const userIsOwnerEmail =
      user.email != null &&
      ["haseeb.a@ziriumai.com", "haseeb.a@zirium.com", "ziriumai@gmail.com"].includes(
        user.email.trim().toLowerCase(),
      );
    // Subscribe for members with a member doc, or for the hard-coded owner email.
    if (!member && !userIsOwnerEmail) return;
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

  // 3. Match current user to their employee record.
  const employee =
    user?.email && employees
      ? (employees.find(
          (e) => e.email.trim().toLowerCase() === user.email!.trim().toLowerCase(),
        ) ?? null)
      : null;

  // 4. Bind auth uid to employee record on first match.
  useEffect(() => {
    if (employee && user && !employee.uid) {
      updateDeveloper(employee.id, { uid: user.uid }).catch(() => {});
    }
  }, [employee, user]);

  // 5. Sync member.role with employee.accessLevel.
  const syncedRolesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !member || employees === null) return;

    // Sync current user's role.
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
        setMember((prev) => prev ? { ...prev, role: targetRole } : prev);
        updateMemberRole(user.uid, targetRole).catch(() => {});
      }
    }

    setRoleSynced(true);

    // If admin: batch-sync all employees' member roles.
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

  // 6. loading is true until auth + member doc + employees + role sync complete.
  const loading =
    !authResolved ||
    (!!user && !memberLoaded) ||
    // If member doc exists, also wait for employees and role sync.
    (!!user && !!member && (employees === null || !roleSynced));

  // 7. Block offboarded, terminated, or unregistered users.
  const isOwnerByEmail =
    user?.email != null &&
    ["haseeb.a@ziriumai.com", "haseeb.a@zirium.com", "ziriumai@gmail.com"].includes(
      user.email.trim().toLowerCase(),
    );

  const isPrivileged = member?.role === "owner" || member?.role === "admin" || isOwnerByEmail;
  const accessBlocked: string | null =
    !user || loading
      ? null
      // Unregistered user (no member doc) who is not the owner email
      : !member && !isOwnerByEmail
        ? "Your email is not registered in the system. Please contact your administrator to be added before logging in or registering."
        : employees === null
          ? null
          : employee
            ? employee.status === "terminated" || employee.status === "offboarded"
              ? "Your account access has been revoked. If you believe this is an error, please contact your administrator."
              : null
            : !isPrivileged
              ? "Your email is not registered in the system. Please contact your administrator to be added before logging in or registering."
              : null;

  // 8. Resolve final app role.
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

  // Auth actions
  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUpWithEmail(name: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = (name || "").trim();
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

  // Show setup screen only on first login (before employee uid is bound).
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
