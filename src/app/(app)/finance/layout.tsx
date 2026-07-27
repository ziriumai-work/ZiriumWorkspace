"use client";

// Finance section shell (admin-only): header + sub-section tabs. The actual
// role gate also lives in the app layout's ROUTE_ACCESS map; this guard is a
// courtesy message in case an employee lands here mid-role-resolution.

import Link from "next/link";
import { usePathname, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/firebase/auth-context";

const TABS = [
  { href: "/finance", label: "Dashboard" },
  { href: "/finance/projects", label: "Projects" },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/allotment", label: "Money Allotment" },
  { href: "/finance/sheet", label: "Monthly Sheet" },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const isSalariesPage = pathname.startsWith("/finance/salaries");

  if (!isAdmin && !isSalariesPage) {
    if (pathname === "/finance") {
      redirect("/finance/salaries");
    }
    return (
      <Box sx={{ mx: "auto", width: "100%", maxWidth: 720, px: 4, py: 5 }}>
        <Typography variant="h1">Finance</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The finance section is restricted to admins.
        </Typography>
      </Box>
    );
  }

  // Filter tabs: non-admins only see the "Monthly Salaries" tab
  const visibleTabs = isAdmin 
    ? [...TABS, { href: "/finance/salaries", label: "Monthly Salaries" }]
    : [{ href: "/finance/salaries", label: "Monthly Salaries" }];

  // Longest-prefix match so /finance/projects highlights Projects, not Dashboard.
  const active =
    visibleTabs.filter(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
    ).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/finance";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 4, pt: 2 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          Finance
        </Typography>
        <Tabs
          value={active}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, py: 0.5 } }}
        >
          {visibleTabs.map((t) => (
            <Tab
              key={t.href}
              value={t.href}
              label={t.label}
              component={Link}
              href={t.href}
              sx={{ fontSize: 13, textTransform: "none", fontWeight: 500 }}
            />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto" }}>{children}</Box>
    </Box>
  );
}
