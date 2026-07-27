"use client";

// Workspace dashboard providing metrics, project summaries, and activity overview.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";
import { subscribeToProjects } from "@/lib/data/projects";
import { subscribeToAllTasks } from "@/lib/data/tasks";
import { subscribeToAllAttendance } from "@/lib/data/attendance";
import { PROJECT_STATUSES, type Project, type DailyTask, type AttendanceRecord } from "@/lib/data/types";
import { STATUS_META, chipSx, TASK_STATUS_COLORS } from "@/components/projectMeta";
import { useAuth } from "@/lib/firebase/auth-context";
import { PersonalDashboard } from "@/components/dashboard/PersonalDashboard";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export default function DashboardPage() {
  const { user, employee, isAdmin } = useAuth();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<DailyTask[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubProjects = subscribeToProjects(
      (p) => {
        setAllProjects(p);
        setLoading(false);
      },
      () => setLoading(false),
    );
    const unsubTasks = isAdmin ? subscribeToAllTasks(setAllTasks) : () => {};
    const unsubAtt = isAdmin ? subscribeToAllAttendance(setAllAttendance) : () => {};

    return () => {
      unsubProjects();
      unsubTasks();
      unsubAtt();
    };
  }, [isAdmin]);

  // Admins see all projects; employees only their assigned ones.
  const projects = useMemo(() => {
    if (isAdmin) return allProjects;
    if (!user) return [];
    return allProjects.filter((p) => 
      p.developerIds.includes(user.uid) || 
      p.assigneeUid === user.uid || 
      (employee && (p.developerIds.includes(employee.id) || p.assigneeUid === employee.id))
    );
  }, [allProjects, isAdmin, user, employee]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  const active = projects.filter(
    (p) => p.status !== "done" && p.status !== "archived",
  ).length;

  const taskStats = useMemo(() => {
    let todo = 0, inProgress = 0, done = 0, overtime = 0;
    for (const t of allTasks) {
      if (t.status === "todo") todo++;
      else if (t.status === "in_progress") inProgress++;
      else if (t.status === "done") done++;
      if (t.isOvertime) overtime++;
    }
    return { total: allTasks.length, todo, inProgress, done, overtime };
  }, [allTasks]);

  const attendanceStats = useMemo(() => {
    let present = 0, absent = 0, late = 0, onLeave = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRecords = allAttendance.filter(r => r.date === todayStr);
    for (const r of todayRecords) {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "on_leave") onLeave++;
    }
    return { total: todayRecords.length, present, absent, late, onLeave };
  }, [allAttendance]);

  const recent = projects.slice(0, 6);
  const firstName = (user?.displayName ?? "there").split(" ")[0];

  if (!isAdmin) {
    return <PersonalDashboard />;
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: { xs: 2, sm: 4, md: 6 }, py: 5 }}>
      <Box component="header" sx={{ mb: 4 }}>
        <Typography variant="h1">Welcome back, {firstName}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {active} active {active === 1 ? "project" : "projects"} across the
          workspace.
        </Typography>
      </Box>

      {/* Global Summaries (Admin Only) */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 4 }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 300,
            p: 1.25,
            px: 2.25,
            borderRadius: 3,
            bgcolor: "surface",
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: { xs: 1.5, sm: 2.5 },
            fontSize: 12,
            fontFamily: "var(--font-geist-mono), monospace",
            transition: "all 0.25s ease-in-out",
            cursor: "default",
            "&:hover": {
              borderColor: "primary.main",
              boxShadow: "0 6px 20px -6px rgba(13, 147, 199, 0.18)",
              transform: "translateY(-2px)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main" }} />
            <Typography variant="caption" sx={{ fontFamily: "inherit", fontWeight: 600, color: "text.primary" }}>
              {taskStats.total} {taskStats.total === 1 ? "Task" : "Tasks"}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ height: 12, my: "auto" }} />
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: TASK_STATUS_COLORS.todo, fontWeight: 600 }}>{taskStats.todo}</Box> to do
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: TASK_STATUS_COLORS.in_progress, fontWeight: 600 }}>{taskStats.inProgress}</Box> in progress
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: TASK_STATUS_COLORS.done, fontWeight: 600 }}>{taskStats.done}</Box> complete
          </Typography>
          {taskStats.overtime > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ height: 12, my: "auto" }} />
              <Typography variant="caption" sx={{ fontFamily: "inherit", color: "#ef4444", fontWeight: 600 }}>
                ⚡ {taskStats.overtime} overtime
              </Typography>
            </>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 300,
            p: 1.25,
            px: 2.25,
            borderRadius: 3,
            bgcolor: "surface",
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: { xs: 1.5, sm: 2.5 },
            fontSize: 12,
            fontFamily: "var(--font-geist-mono), monospace",
            transition: "all 0.25s ease-in-out",
            cursor: "default",
            "&:hover": {
              borderColor: "primary.main",
              boxShadow: "0 6px 20px -6px rgba(13, 147, 199, 0.18)",
              transform: "translateY(-2px)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main" }} />
            <Typography variant="caption" sx={{ fontFamily: "inherit", fontWeight: 600, color: "text.primary" }}>
              Today's Attendance
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ height: 12, my: "auto" }} />
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: "#22c55e", fontWeight: 600 }}>{attendanceStats.present}</Box> present
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: "#f59e0b", fontWeight: 600 }}>{attendanceStats.late}</Box> late
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: "#ef4444", fontWeight: 600 }}>{attendanceStats.absent}</Box> absent
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
            <Box component="span" sx={{ color: "#3b82f6", fontWeight: 600 }}>{attendanceStats.onLeave}</Box> on leave
          </Typography>
        </Box>
      </Box>

      {/* Status summary cards */}
      <Grid container spacing={1.5}>
        {PROJECT_STATUSES.map((s) => (
          <Grid key={s.value} size={{ xs: 6, sm: 4, lg: 2 }}>
            <ScrollReveal>
              <Paper 
                variant="outlined" 
                sx={[
                  chipSx(STATUS_META[s.value].color),
                  { 
                    p: 1.5, 
                    borderRadius: 3,
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: STATUS_META[s.value].color,
                      boxShadow: `0 8px 24px ${alpha(STATUS_META[s.value].color, 0.25)}`,
                    }
                  }
                ]}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: STATUS_META[s.value].color,
                    }}
                  />
                  <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                    {s.label}
                  </Typography>
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    mt: 0.5,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {counts[s.value] ?? 0}
                </Typography>
              </Paper>
            </ScrollReveal>
          </Grid>
        ))}
      </Grid>

      {/* Recently updated */}
      <Box component="section" sx={{ mt: 5 }}>
        <Box
          sx={{
            mb: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="subtitle2">Recently updated</Typography>
          <MuiLink component={Link} href="/projects" variant="actionPill">
            View all
          </MuiLink>
        </Box>

        {loading ? (
          <CircularProgress size={20} />
        ) : recent.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: "center",
              borderRadius: 3,
              borderStyle: "dashed",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No projects yet.
            </Typography>
            <MuiLink
              component={Link}
              href="/projects"
              variant="body2"
              sx={{ mt: 1, display: "inline-block", fontWeight: 500 }}
            >
              Create your first project
            </MuiLink>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            <List disablePadding>
              {recent.map((p, i) => (
                <ScrollReveal key={p.id}>
                  <ListItemButton
                    component={Link}
                    href={`/projects/${p.id}`}
                    divider={i < recent.length - 1}
                    sx={{ py: 1.5, px: 2 }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", width: "100%", gap: 2 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, mb: 0.25 }}
                          noWrap
                        >
                          {p.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Updated {p.updatedAt ? (p.updatedAt as any).toDate?.().toLocaleDateString() ?? "recently" : "recently"}
                        </Typography>
                      </Box>
                      <Chip
                        label={STATUS_META[p.status].label}
                        size="small"
                        sx={[chipSx(STATUS_META[p.status].color), { ml: "auto" }]}
                      />
                    </Box>
                  </ListItemButton>
                </ScrollReveal>
              ))}
              {recent.length === 0 && (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    No projects yet.
                  </Typography>
                  <MuiLink
                    component={Link}
                    href="/projects"
                    variant="body2"
                    sx={{ mt: 1, display: "inline-block", fontWeight: 500 }}
                  >
                    Create your first project
                  </MuiLink>
                </Box>
              )}
            </List>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
