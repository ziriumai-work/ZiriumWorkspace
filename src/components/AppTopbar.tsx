"use client";

// Slim top bar: a path-derived breadcrumb on the left and the global "Ask AI"
// trigger on the right (also reachable via ⌘K).

import { usePathname } from "next/navigation";
import { useAi } from "@/components/ai/AiProvider";
import { useAuth } from "@/lib/firebase/auth-context";

function crumbFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  if (seg === "projects") return "Projects";
  if (seg === "dashboard") return "Dashboard";
  if (seg === "intern") return "My Space";
  if (seg === "zirium") return "Zirium AI";
  if (seg === "team") return "Employees";
  if (seg === "tasks") return "Tasks";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function AppTopbar() {
  const pathname = usePathname();
  const { openAi } = useAi();
  const { isAdmin } = useAuth();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <span className="font-medium text-foreground">
          {crumbFromPath(pathname)}
        </span>
      </nav>

      {/* AI is admin-only (see the role matrix) — hide the trigger otherwise. */}
      {isAdmin && (
        <button
          onClick={() => openAi()}
          className="flex items-center gap-2 rounded-lg border border-border bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:opacity-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
          </svg>
          Ask AI
          <kbd className="rounded border border-accent/30 px-1 text-[10px] font-medium opacity-70">
            ⌘K
          </kbd>
        </button>
      )}
    </header>
  );
}
