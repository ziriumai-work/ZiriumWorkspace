"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
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
      return "Email/password sign-in isn’t enabled for this workspace yet.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default function LoginPage() {
  const { user, role, loading, signInWithGoogle, signInWithEmail, resetPassword } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Already signed in → straight to the role's home screen.
  useEffect(() => {
    if (!loading && user && role) router.replace(ROLE_HOME[role]);
  }, [user, role, loading, router]);

  async function handleGoogle() {
    setError(null);
    setResetMessage(null);
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
      setResetMessage(null);
      return;
    }
    setError(null);
    setResetMessage(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      // Redirect handled by the effect above.
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Please enter your email address first to reset your password.");
      setResetMessage(null);
      return;
    }
    setError(null);
    setResetMessage(null);
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setResetMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err));
    } finally {
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

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
              Or sign in with email
            </Typography>
          </Divider>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {resetMessage && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {resetMessage}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailSubmit();
            }}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <TextField
              label="Email"
              type="email"
              variant="outlined"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || loading}
            />
            <Box>
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                variant="outlined"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy || loading}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={busy || loading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                <MuiLink
                  component="button"
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={busy || loading}
                  variant="caption"
                  color="primary"
                  underline="hover"
                  sx={{ fontWeight: 500 }}
                >
                  Forgot password?
                </MuiLink>
              </Box>
            </Box>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy || loading}
              fullWidth
              sx={{ py: 1.25, mt: 1, fontSize: 14 }}
            >
              Sign In
            </Button>
          </Box>
        </Paper>

        <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 4 }}>
          First time?{" "}
          <MuiLink
            component={Link}
            href="/register"
            color="primary"
            underline="hover"
            sx={{ fontWeight: 500 }}
          >
            Complete registration
          </MuiLink>
        </Typography>

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

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  );
}
