"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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

function friendlyAuthError(err: unknown): string {
  if (err instanceof Error && !(err instanceof FirebaseError)) {
    // Plain errors (e.g. our pre-flight email check) already have a friendly message.
    return err.message || "Registration failed. Please try again.";
  }
  const code = err instanceof FirebaseError ? err.code : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn’t look valid.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password is too weak — use at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn’t enabled for this workspace yet.";
    default:
      return "Registration failed. Please try again.";
  }
}

export default function RegisterPage() {
  const { user, role, loading, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Prefetch destination routes so JavaScript bundles compile in browser memory before registration.
  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/projects");
    router.prefetch("/intern");
  }, [router]);

  useEffect(() => {
    if (!loading && user && role) router.replace(ROLE_HOME[role]);
  }, [user, role, loading, router]);

  async function handleEmailSubmit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Name is not required because the admin already created the employee record with their name.
      await signUpWithEmail("", email.trim(), password);
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
            Complete Registration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Set your password to access your workspace.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
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
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy || loading}
              fullWidth
              sx={{ py: 1.25, mt: 1, fontSize: 14 }}
            >
              {busy || loading ? "Setting up workspace..." : "Set Password"}
            </Button>
          </Box>
        </Paper>

        <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 4 }}>
          Already registered?{" "}
          <MuiLink
            component={Link}
            href="/login"
            color="primary"
            underline="hover"
            sx={{ fontWeight: 500 }}
          >
            Sign in
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
}
