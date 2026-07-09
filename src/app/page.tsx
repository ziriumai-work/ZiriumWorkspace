"use client";

// Landing route ("/"): send people to the dashboard if signed in, otherwise to
// the login page. Auth state only exists on the client (Firebase SDK), so this
// redirect happens client-side.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-neutral-500">Loading…</p>
    </main>
  );
}
