"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/firebase/auth-context";
import { ROLE_HOME } from "@/lib/data/types";

// Map Firebase auth error codes to friendly copy.
function friendlyAuthError(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/invalid-email":
      return "That email address doesn’t look valid.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password is too weak — use at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn’t enabled for this workspace yet. Enable it in Firebase Console → Authentication → Sign-in method.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default function LoginPage() {
  const { user, role, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email/password form state. `mode` toggles between sign-in and sign-up.
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Already signed in → straight to the role's home screen. Waits for the
  // role to resolve so interns land on My Space, not the dashboard.
  useEffect(() => {
    if (!loading && user && role) router.replace(ROLE_HOME[role]);
  }, [user, role, loading, router]);

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // Redirect handled by the effect above once auth state updates.
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  async function handleEmailSubmit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(name, email.trim(), password);
      }
      // Redirect handled by the effect above.
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Box sx={{ mb: 4, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 4,
              bgcolor: "background.paper",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              border: "1px solid",
              borderColor: "divider",
              mb: 3,
              overflow: "hidden"
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo"
              style={{ height: "100%", width: "100%", objectFit: "cover" }}
            />
          </Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
            Welcome to Zirium Workspace
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Your company hub for projects, docs, and AI automations.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
          <Button
            onClick={handleGoogle}
            disabled={busy || loading}
            fullWidth
            variant="outlined"
            color="inherit"
            size="large"
            startIcon={<GoogleIcon />}
            sx={{ py: 1.25, fontSize: 14 }}
          >
            Continue with Google
          </Button>

          <Divider sx={{ my: 2.5, fontSize: 12, color: "text.secondary" }}>
            or {mode === "signin" ? "sign in" : "create an account"} with email
          </Divider>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailSubmit();
            }}
            sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
          >
            {mode === "signup" && (
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                label="Full name"
                autoComplete="name"
                fullWidth
              />
            )}
            <TextField
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              label="Email"
              type="email"
              autoComplete="email"
              fullWidth
            />
            <TextField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              fullWidth
            />
            <Button
              type="submit"
              disabled={busy || loading}
              fullWidth
              variant="contained"
              size="large"
              sx={{ py: 1.1, fontSize: 14 }}
            >
              {busy
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 2, display: "block", textAlign: "center" }}
          >
            {mode === "signin" ? (
              <>
                Don’t have an account?{" "}
                <MuiLink
                  component="button"
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  sx={{ fontSize: "inherit", verticalAlign: "baseline" }}
                >
                  Create one
                </MuiLink>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <MuiLink
                  component="button"
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  sx={{ fontSize: "inherit", verticalAlign: "baseline" }}
                >
                  Sign in
                </MuiLink>
              </>
            )}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 3, display: "block", textAlign: "center" }}
        >
          Restricted to members of your company.
        </Typography>
      </Box>
    </Box>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
