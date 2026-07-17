"use client";

// The persistent workspace sidebar: brand, primary navigation, and the
// signed-in user with a sign-out action. Phase 2 will add a nested page tree
// below the primary nav.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/firebase/auth-context";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
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
    href: "/employees",
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
  {
    href: "/attendance",
    label: "Attendance",
    roles: ["admin", "employee", "intern"],
    icon: (
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z" />
    ),
  },
  {
    href: "/finance",
    label: "Finance",
    roles: ["admin"],
    icon: (
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.9 15.5v1.3h-1.7v-1.3c-1.6-.3-2.9-1.2-3-2.9h1.9c.1.8.7 1.4 2 1.4 1.4 0 1.8-.7 1.8-1.2 0-.6-.4-1.2-2-1.6-1.9-.4-3.4-1.2-3.4-3 0-1.5 1.2-2.5 2.7-2.8V6.2h1.7v1.3c1.6.3 2.6 1.4 2.7 2.8h-1.9c0-.8-.5-1.4-1.7-1.4-1.1 0-1.7.5-1.7 1.2 0 .6.5 1 2 1.4 2 .5 3.4 1.2 3.4 3.1 0 1.6-1.2 2.6-2.8 2.9Z" />
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    roles: ["admin", "employee", "intern"],
    icon: (
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    ),
  },
  {
    href: "/announcements",
    label: "Announcements",
    roles: ["admin"],
    icon: (
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, member, role, signOut } = useAuth();
  // While the role is still resolving, show the common items only.
  const nav = NAV.filter((item) => item.roles.includes(role ?? "employee"));

  return (
    <Box
      component="aside"
      sx={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "surface",
        borderRadius: 3,
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <img src="/logo.png" alt="Logo" className="h-7 w-7 object-cover rounded-md shadow-sm" />
        <span className="text-sm font-semibold tracking-tight">Zirium Workspace</span>
      </div>

      <List dense sx={{ flex: 1, px: 1, py: 0 }}>
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={active}
              sx={{
                borderRadius: 4,
                mb: 0.5,
                py: 1,
                px: 2,
                color: "text.secondary",
                position: "relative",
                "&.Mui-selected, &.Mui-selected:hover": {
                  bgcolor: "accentSoft",
                  color: "primary.main",
                  fontWeight: 500,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: "inherit" }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={active ? "currentColor" : "none"}
                  stroke={active ? "none" : "currentColor"}
                  strokeWidth={active ? "0" : "1.6"}
                >
                  {item.icon}
                </svg>
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: { fontSize: 14, fontWeight: active ? 500 : 400 },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {role === "admin" && (
        <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", px: 1 }}>
          <CurrencySwitcher />
        </Box>
      )}

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar
            src={user?.photoURL ?? undefined}
            slotProps={{ img: { referrerPolicy: "no-referrer" } }}
            sx={{
              width: 28,
              height: 28,
              fontSize: 12,
              fontWeight: 600,
              bgcolor: "accentSoft",
              color: "primary.main",
            }}
          >
            {(user?.displayName ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              noWrap
              sx={{ fontWeight: 600, display: "block" }}
            >
              {user?.displayName ?? user?.email}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block", fontSize: 11, textTransform: "capitalize" }}
            >
              {role ?? member?.role ?? "member"}
            </Typography>
          </Box>
        </Box>
        <Button
          onClick={() => signOut()}
          fullWidth
          color="inherit"
          sx={{
            mt: 1,
            justifyContent: "flex-start",
            color: "text.secondary",
            fontWeight: 400,
            fontSize: 12,
          }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );
}
