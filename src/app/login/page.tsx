"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { ROLE_HOME } from "@/lib/data/types";

export default function LoginPage() {
  const { user, role, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → straight to the role's home screen. Waits for the
  // role to resolve so interns land on My Space, not the dashboard.
  useEffect(() => {
    if (!loading && user && role) router.replace(ROLE_HOME[role]);
  }, [user, role, loading, router]);

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // Redirect handled by the effect above once auth state updates.
    } catch (err) {
      console.error(err);
      setError("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-xl font-bold text-accent-foreground shadow-sm">
            W
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Welcome to Workspace
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Your company hub for projects, docs, and AI automations.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <button
            onClick={handleSignIn}
            disabled={signingIn || loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-surface disabled:opacity-60"
          >
            <GoogleIcon />
            {signingIn ? "Signing in…" : "Continue with Google"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Restricted to members of your company.
        </p>
      </div>
    </main>
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
