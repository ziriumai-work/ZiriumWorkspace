"use client";

// Dashboard: a live overview of the workspace. Phase 1 shows project counts by
// status plus the most recently updated projects. As more databases and
// automations land, this becomes the home for cross-workspace summaries.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { subscribeToProjects } from "@/lib/data/projects";
import { PROJECT_STATUSES, type Project } from "@/lib/data/types";
import { STATUS_META, chipSx } from "@/components/projectMeta";
import { useAuth } from "@/lib/firebase/auth-context";
import { PersonalDashboard } from "@/components/dashboard/PersonalDashboard";

export default function DashboardPage() {
  const { user, employee, isAdmin } = useAuth();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToProjects(
      (p) => {
        setAllProjects(p);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  // Admins see all projects; employees only their assigned ones.
  const projects = useMemo(() => {
    if (isAdmin) return allProjects;
    if (!employee) return [];
    return allProjects.filter((p) => p.developerIds.includes(employee.id));
  }, [allProjects, isAdmin, employee]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  const active = projects.filter(
    (p) => p.status !== "done" && p.status !== "archived",
  ).length;

  const recent = projects.slice(0, 6);
  const firstName = (user?.displayName ?? "there").split(" ")[0];

  if (!isAdmin) {
    return <PersonalDashboard />;
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 5 }}>
      <Box component="header" sx={{ mb: 4 }}>
        <Typography variant="h1">Welcome back, {firstName}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {active} active {active === 1 ? "project" : "projects"} across the
          workspace.
        </Typography>
      </Box>

      {/* Status summary cards */}
      <Grid container spacing={1.5}>
        {PROJECT_STATUSES.map((s) => (
          <Grid key={s.value} size={{ xs: 6, sm: 4, lg: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: STATUS_META[s.value].color,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
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
          <MuiLink
            component={Link}
            href="/projects"
            variant="caption"
            color="text.secondary"
            underline="hover"
          >
            View all →
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
                <ListItemButton
                  key={p.id}
                  component={Link}
                  href={`/projects/${p.id}`}
                  divider={i < recent.length - 1}
                  sx={{ gap: 1.5, px: 2, py: 1.5 }}
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
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {p.title}
                  </Typography>
                  <Chip
                    label={STATUS_META[p.status].label}
                    sx={chipSx(STATUS_META[p.status].color)}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
