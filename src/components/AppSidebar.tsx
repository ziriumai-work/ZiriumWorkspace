"use client";

// The persistent workspace sidebar: brand, primary navigation, and the
// signed-in user with a sign-out action. Phase 2 will add a nested page tree
// below the primary nav.

import { useState } from "react";
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
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useColorScheme } from "@mui/material/styles";
import { useAuth } from "@/lib/firebase/auth-context";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import type { AppRole } from "@/lib/data/types";

// Each item lists the roles that see it (matches ROUTE_ACCESS in the app
// layout, which enforces the same map on direct navigation).
const NAV: {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: AppRole[];
}[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: ["admin", "member", "employee", "intern"],
    icon: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    href: "/projects",
    label: "Projects",
    roles: ["admin", "member", "employee", "intern"],
    icon: (
      <>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    roles: ["admin", "employee", "intern"],
    icon: (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
  },
  {
    href: "/employees",
    label: "Employees",
    roles: ["admin"],
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    href: "/ai",
    label: "Zirium AI",
    roles: ["admin", "employee", "intern", "member"],
    icon: (
      <>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </>
    ),
  },
  {
    href: "/attendance",
    label: "Attendance",
    roles: ["admin", "employee", "intern"],
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  },
  {
    href: "/finance/salaries",
    label: "Finance",
    roles: ["admin", "employee", "intern"],
    icon: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    roles: ["admin", "member", "employee", "intern"],
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </>
    ),
  },
  {
    href: "/announcements",
    label: "Announcements",
    roles: ["admin", "member", "employee", "intern"],
    icon: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, member, employee, role, signOut, isAdmin } = useAuth();
  const { mode, setMode } = useColorScheme();
  const [collapsed, setCollapsed] = useState(false);

  const isPaid = !!employee?.monthlySalary && employee.monthlySalary > 0;

  // While the role is still resolving, show the common items only.
  const nav = NAV.filter((item) => {
    if (item.label === "Finance") {
      if (isAdmin) return true;
      if (isPaid) {
        item.label = "Salary";
        return true;
      }
      return false;
    }
    return item.roles.includes(role ?? "member");
  });

  return (
    <Box
      component="nav"
      sx={{
        width: collapsed ? 80 : 260,
        transition: "width 0.2s ease-in-out",
        flexShrink: 0,
        bgcolor: "surface",
        borderRight: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        pt: 2,
        pb: 1,
        overflowX: "hidden",
      }}
    >
      <Box sx={{ px: collapsed ? 1 : 3, mb: 2, display: "flex", flexDirection: collapsed ? "column" : "row", alignItems: "center", gap: 1.5, justifyContent: collapsed ? "center" : "flex-start" }}>
        <img src="/logo.png" alt="Logo" style={{ height: 28, width: 28, objectFit: "cover", borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.12)", marginBottom: collapsed ? 4 : 0 }} />
        {!collapsed && (
          <Typography variant="subtitle2" noWrap sx={{ fontSize: 16, letterSpacing: "-0.01em", flex: 1 }}>
            Workspace
          </Typography>
        )}
        <IconButton onClick={() => setCollapsed(!collapsed)} size="small" sx={{ color: "text.secondary" }}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <List sx={{ px: 1.5, flex: 1, overflowY: "auto", overflowX: "hidden", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Tooltip title={collapsed ? item.label : ""} placement="right" key={item.href}>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={active}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  px: 2,
                  justifyContent: "flex-start",
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: "action.hover",
                    color: "text.primary",
                  },
                  "&.Mui-selected, &.Mui-selected:hover": {
                    bgcolor: "accentSoft",
                    color: "primary.main",
                    fontWeight: 500,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit", mr: collapsed ? 0 : 1, pl: collapsed ? 1 : 0 }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {item.icon}
                  </svg>
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: { sx: { fontSize: 14, fontWeight: active ? 600 : 500 } },
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      {role === "admin" && !collapsed && (
        <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", px: 2, mb: 1 }}>
          <CurrencySwitcher />
        </Box>
      )}

      {role === "admin" && collapsed && <Box sx={{ mt: "auto" }} />}

      <Divider />
      <Box sx={{ p: collapsed ? 1 : 1.5, display: "flex", flexDirection: "column", alignItems: collapsed ? "center" : "stretch" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: collapsed ? 2 : 0, justifyContent: collapsed ? "center" : "flex-start" }}>
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
          {!collapsed && (
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
          )}
          {!collapsed && (
            <IconButton 
              onClick={() => setMode(mode === 'light' ? 'dark' : 'light')} 
              size="small" 
              color="inherit"
              sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
            >
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          )}
        </Box>
        
        {collapsed && (
          <IconButton 
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')} 
            size="small" 
            color="inherit"
            sx={{ mb: 1, color: "text.secondary", "&:hover": { color: "primary.main" } }}
          >
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        )}

        {collapsed ? (
          <IconButton onClick={() => signOut()} size="small" color="error" sx={{ mt: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </IconButton>
        ) : (
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
              "&:hover": { color: "error.main", bgcolor: "error.soft" },
            }}
          >
            Sign out
          </Button>
        )}
      </Box>
    </Box>
  );
}
