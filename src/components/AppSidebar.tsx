"use client";

// The persistent workspace sidebar: brand, primary navigation, and the
// signed-in user with a sign-out action. Phase 2 will add a nested page tree
// below the primary nav.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import type { AppRole } from "@/lib/data/types";

// Each item lists the roles that see it (matches ROUTE_ACCESS in the app
// layout, which enforces the same map on direct navigation).
const NAV: {
  href: string;
  label: string;
  roles: AppRole[];
  icon: React.ReactNode;
}[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: ["admin", "employee"],
    icon: (
      <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
    ),
  },
  {
    href: "/intern",
    label: "My Space",
    roles: ["intern"],
    icon: (
      <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
    ),
  },
  {
    href: "/projects",
    label: "Projects",
    roles: ["admin", "employee", "intern"],
    icon: (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    roles: ["admin", "employee", "intern"],
    icon: (
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z" />
    ),
  },
  {
    href: "/team",
    label: "Employees",
    roles: ["admin"],
    icon: (
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-8 1.3-8 4v3h9v-3c0-1 .4-1.9 1-2.6A13 13 0 0 0 8 13Zm8 0c-.3 0-.7 0-1.1.1A5 5 0 0 1 17 17v3h7v-3c0-2.7-5.3-4-8-4Z" />
    ),
  },
  {
    href: "/zirium",
    label: "Zirium AI",
    roles: ["admin"],
    icon: (
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, member, role, signOut } = useAuth();
  // While the role is still resolving, show the common items only.
  const nav = NAV.filter((item) => item.roles.includes(role ?? "employee"));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          W
        </div>
        <span className="text-sm font-semibold tracking-tight">Workspace</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-card hover:text-foreground"
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={active ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.6"
              >
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt=""
              className="h-7 w-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
              {(user?.displayName ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {user?.displayName ?? user?.email}
            </p>
            <p className="truncate text-[11px] capitalize text-muted">
              {role ?? member?.role ?? "member"}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-2 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted transition hover:bg-card hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
