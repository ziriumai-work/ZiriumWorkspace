"use client";

// Layout for the authenticated area. Client Component because the auth guard
// depends on browser-only auth state. Wraps the workspace in the AI assistant
// provider so any page can summon it. Shell = sidebar + (top bar + content).

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { AiProvider } from "@/components/ai/AiProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <AiProvider>
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </AiProvider>
  );
}
