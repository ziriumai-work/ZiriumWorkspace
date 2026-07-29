"use client";

import { useEffect, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToLogs } from "@/lib/data/logs";
import { subscribeToMembers } from "@/lib/data/members";
import { subscribeToDevelopers } from "@/lib/data/developers";
import type { AdminLog } from "@/lib/data/types";
import { LogsFilters } from "@/components/logs/LogsFilters";
import { LogsTable } from "@/components/logs/LogsTable";

export default function AdminLogsPage() {
  const { user, role, isAdmin, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersMap, setMembersMap] = useState<Record<string, string>>({});
  const [nonAdminNames, setNonAdminNames] = useState<Set<string>>(new Set());
  
  const canAccess =
    isAdmin ||
    role === "admin" ||
    (user?.email && (
      user.email.toLowerCase() === "haseeb.a@ziriumai.com" ||
      user.email.toLowerCase() === "ziriumai@gmail.com"
    ));

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }

    const unsubLogs = subscribeToLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
      setLoading(false);
    }, 500); // Fetch latest 500 logs for client-side filtering

    const unsubMembers = subscribeToMembers((members) => {
      const map: Record<string, string> = {};
      members.forEach((m) => {
        map[m.uid] = m.role;
      });
      setMembersMap(map);
    });

    const unsubDevs = subscribeToDevelopers((devs) => {
      const namesSet = new Set<string>();
      devs.forEach((d) => {
        if (d.role === "employee" || d.role === "intern") {
          if (d.name) namesSet.add(d.name.trim().toLowerCase());
          if (d.email) namesSet.add(d.email.trim().toLowerCase());
          if (d.uid) namesSet.add(d.uid);
        }
      });
      setNonAdminNames(namesSet);
    });

    return () => {
      unsubLogs();
      unsubMembers();
      unsubDevs();
    };
  }, [canAccess]);

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 0. Only show admin / owner actions (filter out intern, employee, member roles)
      if (log.adminId && membersMap[log.adminId]) {
        const r = membersMap[log.adminId];
        if (r === "employee" || r === "intern" || r === "member") {
          return false;
        }
      }
      if (log.adminId && nonAdminNames.has(log.adminId)) {
        return false;
      }
      if (log.adminName && nonAdminNames.has(log.adminName.trim().toLowerCase())) {
        return false;
      }

      // 1. Date filter
      if (dateFilter) {
        if (!log.timestamp) return false;
        let dateObj: Date | null = null;
        if (typeof (log.timestamp as any).toDate === "function") {
          dateObj = (log.timestamp as any).toDate();
        } else if (log.timestamp instanceof Date) {
          dateObj = log.timestamp;
        }
        if (!dateObj || isNaN(dateObj.getTime())) return false;

        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        const logDateStr = `${y}-${m}-${d}`;
        
        if (logDateStr !== dateFilter) return false;
      }

      // 2. Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchAdmin = (log.adminName || "").toLowerCase().includes(query);
        const matchAction = (log.action || "").toLowerCase().includes(query);
        const matchDetails = (log.details || "").toLowerCase().includes(query);
        if (!matchAdmin && !matchAction && !matchDetails) return false;
      }

      return true;
    });
  }, [logs, searchQuery, dateFilter, membersMap]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Access guard
  if (!user || !canAccess) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Alert severity="error" variant="filled">
          Access Denied. You must be an admin to view this page.
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, md: 4 }, width: "100%" }}>
      <Box sx={{ mb: 4 }} className="animate-fade-in">
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: "-0.02em" }}>
          Admin Logs
        </Typography>
        <Typography color="text.secondary" variant="body1">
          Read-only audit trail of actions performed by administrators.
        </Typography>
      </Box>

      <Box className="animate-pop-in" sx={{ animationDelay: "100ms", animationFillMode: "backwards" }}>
        <LogsFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
        />

        <LogsTable logs={filteredLogs} />
      </Box>
    </Box>
  );
}
