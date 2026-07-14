"use client";

// Layout for the authenticated area. Client Component because the auth guard
// depends on browser-only auth state. Wraps the workspace in the AI assistant
// provider so any page can summon it. Shell = sidebar + (top bar + content).
//
// Two guards run here:
//  1. Signed out → /login.
//  2. Role-based route access: each role only reaches its permitted routes
//     (see ROUTE_ACCESS); anything else bounces to that role's home screen.
// This is UI-level enforcement — the Firestore rules hardening that backs it
// at the database level is tracked separately.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "@/lib/firebase/auth-context";
import { ROLE_HOME, type AppRole } from "@/lib/data/types";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { AiProvider } from "@/components/ai/AiProvider";

// Which roles may visit which top-level routes. Prefix match; routes not
// listed (none today) are open to every signed-in user.
const ROUTE_ACCESS: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/dashboard", roles: ["admin", "employee"] },
  { prefix: "/intern", roles: ["intern"] },
  { prefix: "/projects", roles: ["admin", "employee", "intern"] },
  { prefix: "/tasks", roles: ["admin", "employee", "intern"] },
  { prefix: "/team", roles: ["admin"] },
  { prefix: "/zirium", roles: ["admin"] },
];

function allowedPath(role: AppRole, pathname: string): boolean {
  const rule = ROUTE_ACCESS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  return !rule || rule.roles.includes(role);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Keep each role on its permitted routes once the role is known.
  useEffect(() => {
    if (role && !allowedPath(role, pathname)) {
      router.replace(ROLE_HOME[role]);
    }
  }, [role, pathname, router]);

  if (loading || !user || (role && !allowedPath(role, pathname))) {
    return (
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={22} />
      </Box>
    );
  }

  return (
    <AiProvider>
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <AppSidebar />
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <AppTopbar />
          <Box sx={{ flex: 1, overflowY: "auto" }}>{children}</Box>
        </Box>
      </Box>
    </AiProvider>
  );
}
