"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToProjects } from "@/lib/data/projects";
import { subscribeToTasksForEmployee, updateTask } from "@/lib/data/tasks";
import { subscribeToDevelopers } from "@/lib/data/developers";
import {
  STATUS_META,
  TASK_STATUS_COLORS,
  chipSx,
} from "@/components/projectMeta";
import { PillSelect } from "@/components/ui/PillSelect";
import { red } from "@/lib/theme/colors";
import {
  DAILY_TASK_STATUSES,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  type DailyTask,
  type DailyTaskStatus,
  type Employee,
  type Project,
} from "@/lib/data/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function PersonalDashboard() {
  const { user, employee, role } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [directory, setDirectory] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;
    const u1 = subscribeToProjects(setProjects);
    const u2 = subscribeToTasksForEmployee(employee.id, (t) => {
      setTasks(t);
      setLoading(false);
    });
    const u3 = subscribeToDevelopers(setDirectory);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [employee]);

  const myProjects = useMemo(
    () =>
      projects.filter((p) => 
        (user && (p.developerIds.includes(user.uid) || p.assigneeUid === user.uid)) ||
        (employee && (p.developerIds.includes(employee.id) || p.assigneeUid === employee.id))
      ),
    [projects, user, employee],
  );

  const team = useMemo(
    () =>
      employee
        ? directory.filter(
            (e) => e.department === employee.department && e.status === "active",
          )
        : [],
    [directory, employee],
  );

  const today = todayIso();
  const weekAgo = isoDaysAgo(7);

  const pending = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status !== "done")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [tasks],
  );
  const dueToday = pending.filter((t) => t.date === today).length;
  const doneThisWeek = tasks.filter(
    (t) => t.status === "done" && t.date >= weekAgo,
  ).length;
  const activeProjects = myProjects.filter(
    (p) => p.status !== "done" && p.status !== "archived",
  ).length;

  const firstName = (user?.displayName ?? employee?.name ?? "there").split(
    " ",
  )[0];
  const deptLabel = employee
    ? (DEPARTMENTS.find((d) => d.value === employee.department)?.label ??
      employee.department)
    : "";

  if (!employee) {
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

  const roleLabel = role === "employee" ? "Employee" : role === "intern" ? "Intern" : "Admin";

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 5 } }}>
      {/* Header */}
      <Box component="header" sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Typography variant="h1">Welcome, {firstName}</Typography>
          <Chip
            label={roleLabel}
            sx={{
              bgcolor: "accentSoft",
              color: "primary.main",
              fontWeight: 600,
              fontSize: 11,
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {employee.role || roleLabel} · {deptLabel} team ·{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Stat label="Due today" value={dueToday} accent={dueToday > 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Stat label="Pending tasks" value={pending.length} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Stat label="Active projects" value={activeProjects} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Stat label="Done this week" value={doneThisWeek} />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Main column */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* This week's tasks */}
            <Box component="section">
              <Box
                sx={{
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="subtitle2">My pending tasks</Typography>
                <MuiLink component={Link} href="/tasks" variant="actionPill">Open My Tasks</MuiLink>
              </Box>

              {loading ? (
                <CircularProgress size={20} />
              ) : pending.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: "center",
                    borderRadius: 3,
                    borderStyle: "dashed",
                    bgcolor: "background.default",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    All caught up — no pending tasks. 🎉
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {pending.map((t) => (
                    <Paper
                      key={t.id}
                      variant="outlined"
                      sx={{
                        display: "flex",
                        gap: 1.5,
                        borderRadius: 3,
                        px: 2,
                        py: 2,
                        transition: "box-shadow 0.2s",
                        "&:hover": { boxShadow: 1 },
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {t.title}
                          </Typography>
                          {t.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              noWrap
                              sx={{ mt: 0.5 }}
                            >
                              {t.description}
                            </Typography>
                          )}
                        </Box>
                        
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          {t.date < today ? (
                            <Chip
                              label={`Overdue · ${t.date}`}
                              sx={[chipSx(red.main), { fontSize: 11, height: 22 }]}
                            />
                          ) : t.date === today ? (
                            <Chip
                              label="Today"
                              sx={{
                                bgcolor: "accentSoft",
                                color: "primary.main",
                                fontWeight: 500,
                                fontSize: 11,
                                height: 22,
                              }}
                            />
                          ) : (
                            <Chip
                              label={t.date}
                              sx={{ bgcolor: "surface", fontSize: 11, height: 22 }}
                            />
                          )}
                          {t.projectTitle && (
                            <Chip
                              label={t.projectTitle}
                              sx={{ bgcolor: "surface", fontSize: 11, height: 22 }}
                            />
                          )}
                        </Box>
                      </Box>

                      <Box sx={{ width: 140, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1.5, flexShrink: 0 }}>
                        <PillSelect
                          value={t.status}
                          options={role === "admin" ? DAILY_TASK_STATUSES : DAILY_TASK_STATUSES.filter(s => s.value !== "done")}
                          color={TASK_STATUS_COLORS[t.status]}
                          onChange={(status: DailyTaskStatus) =>
                            updateTask(t.id, { status })
                          }
                        />
                        <MuiLink
                          component={Link}
                          href="/tasks"
                          variant="caption"
                          underline="none"
                          sx={{
                            position: "relative",
                            fontWeight: 600,
                            color: "text.secondary",
                            transition: "color 0.2s ease",
                            "&:hover": {
                              color: "primary.main",
                            },
                            "&::after": {
                              content: '""',
                              position: "absolute",
                              bottom: -2,
                              left: 0,
                              width: "100%",
                              height: "2px",
                              borderRadius: "2px",
                              bgcolor: "primary.main",
                              transform: "scaleX(0)",
                              transformOrigin: "right",
                              transition: "transform 0.3s ease",
                            },
                            "&:hover::after": {
                              transform: "scaleX(1)",
                              transformOrigin: "left",
                            },
                          }}
                        >
                          Submit report
                        </MuiLink>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>

            {/* My projects */}
            <Box component="section">
              <Box
                sx={{
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="subtitle2">My projects</Typography>
                <MuiLink component={Link} href="/projects" variant="actionPill">View all</MuiLink>
              </Box>

              {myProjects.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: "center",
                    borderRadius: 3,
                    borderStyle: "dashed",
                    bgcolor: "background.default",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Not assigned to any project
                  </Typography>
                </Paper>
              ) : (
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
                  <List disablePadding>
                    {myProjects.map((p, i) => (
                      <ListItemButton
                        key={p.id}
                        component={Link}
                        href={`/projects/${p.id}`}
                        divider={i < myProjects.length - 1}
                        sx={{ gap: 1.5, px: 2, py: 2 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            flexShrink: 0,
                            borderRadius: "50%",
                            bgcolor: STATUS_META[p.status].color,
                          }}
                        />
                        <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 500 }}>
                          {p.title}
                        </Typography>
                        {p.projectRoles?.[employee.id] && (
                          <Chip
                            label={p.projectRoles[employee.id]}
                            sx={{
                              bgcolor: "accentSoft",
                              color: "primary.main",
                              fontWeight: 500,
                              fontSize: 11,
                              height: 22,
                            }}
                          />
                        )}
                        <Chip
                          label={STATUS_META[p.status].label}
                          sx={[chipSx(STATUS_META[p.status].color), { height: 22 }]}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Side column */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Profile */}
            <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                My profile
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar
                  src={user?.photoURL ?? undefined}
                  slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                  sx={{
                    width: 48,
                    height: 48,
                    fontSize: 16,
                    fontWeight: 600,
                    bgcolor: "accentSoft",
                    color: "primary.main",
                  }}
                >
                  {employee.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {employee.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {employee.email}
                  </Typography>
                </Box>
              </Box>
              <Box component="dl" sx={{ m: 0, mt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                <ProfileRow label="Title" value={employee.role || "—"} />
                <ProfileRow label="Department" value={deptLabel} />
                <ProfileRow
                  label="Type"
                  value={
                    EMPLOYMENT_TYPES.find(
                      (t) => t.value === employee.employmentType,
                    )?.label ?? "—"
                  }
                />
                <ProfileRow label="Started" value={employee.startDate || "—"} />
              </Box>
            </Paper>

            {/* Team */}
            <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {deptLabel} team
              </Typography>
              {team.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No teammates yet.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {team.map((m) => (
                    <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar
                        src={m.photoURL || undefined}
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: 12,
                          fontWeight: 600,
                          bgcolor: "surface",
                          color: "text.primary",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                          {m.name}
                          {m.id === employee.id && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                            >
                              {" "}
                              (you)
                            </Typography>
                          )}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block", fontSize: 11 }}
                        >
                          {m.role || "—"}
                        </Typography>
                      </Box>
                      {m.accessLevel === "admin" && (
                        <Chip
                          label="Admin"
                          sx={{ bgcolor: "surface", fontSize: 10, height: 20, color: "text.secondary", fontWeight: 600 }}
                        />
                      )}
                      {m.accessLevel === "intern" && m.id !== employee.id && (
                        <Chip
                          label="Intern"
                          sx={{ bgcolor: "surface", fontSize: 10, height: 20, color: "text.secondary", fontWeight: 600 }}
                        />
                      )}
                      {m.accessLevel === "employee" && m.id !== employee.id && (
                        <Chip
                          label="Employee"
                          sx={{ bgcolor: "surface", fontSize: 10, height: 20, color: "text.secondary", fontWeight: 600 }}
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: accent ? 'accentSoft' : 'background.paper' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: accent ? "primary.main" : "text.primary",
        }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5 }}>
      <Typography component="dt" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body2" noWrap sx={{ m: 0, textAlign: "right", fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

