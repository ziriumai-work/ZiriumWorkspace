"use client";

// The Projects database. Subscribes to projects + member profiles in real time
// and renders one of two views (Table / Board). Creating, editing status, and
// deleting all write straight to Firestore; the subscription reflects changes
// back instantly (and for every other signed-in user too).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { subscribeToProjects, createProject } from "@/lib/data/projects";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { useAuth } from "@/lib/firebase/auth-context";
import type { Developer, Project } from "@/lib/data/types";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { AiProjectAgent } from "@/components/projects/AiProjectAgent";

export default function ProjectsPage() {
  const { user, employee, isAdmin } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgent, setShowAgent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "completed">("pending");

  useEffect(() => {
    const unsubProjects = subscribeToProjects(
      (p) => {
        setProjects(p);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    const unsubDevs = subscribeToDevelopers(setDevelopers);
    return () => {
      unsubProjects();
      unsubDevs();
    };
  }, []);

  // Roster lookup for rendering assigned developers in the table/board.
  const devMap = useMemo(
    () => Object.fromEntries(developers.map((d) => [d.id, d])),
    [developers],
  );

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title || !user) return;
    setCreating(true);
    setError(null);
    try {
      await createProject({ title }, user.uid);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  // Admins see all projects; employees see only the ones they're assigned to.
  const visibleProjects = useMemo(() => {
    if (!user) return [];
    return projects.filter(p => isAdmin || p.developerIds.includes(user.uid) || p.assigneeUid === user.uid);
  }, [projects, user, isAdmin]);

  const displayedProjects = useMemo(() => {
    if (tab === "pending") {
      return visibleProjects.filter((p) => p.status !== "done" && p.status !== "archived");
    }
    return visibleProjects.filter((p) => p.status === "done" || p.status === "archived");
  }, [visibleProjects, tab]);

  const sorted = useMemo(
    () => [...displayedProjects].sort((a, b) => a.order - b.order),
    [displayedProjects],
  );

  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column" }}>
      <AiProjectAgent
        open={showAgent}
        onClose={() => setShowAgent(false)}
        onCreated={(newId) => {
          setShowAgent(false);
          router.push(`/projects/${newId}`);
        }}
      />

      {/* Header + toolbar */}
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          px: 4,
          py: 2,
        }}
      >
        <Typography variant="h2">Projects</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isAdmin && (
            <Button
              onClick={() => setShowAgent(true)}
              sx={{ bgcolor: "accentSoft", color: "primary.main" }}
              startIcon={
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                </svg>
              }
            >
              Generate with AI
            </Button>
          )}
          <ToggleButtonGroup
            value={tab}
            exclusive
            onChange={(_, v: "pending" | "completed" | null) => v && setTab(v)}
            size="small"
            sx={{ ml: 2, "& .MuiToggleButton-root": { px: 1.5, py: 0.5, fontSize: 12 } }}
          >
            <ToggleButton value="pending">Pending</ToggleButton>
            <ToggleButton value="completed">Completed</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Quick-add row (admins only) */}
      {isAdmin && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderBottom: 1,
            borderColor: "divider",
            px: 4,
            py: 1.5,
          }}
        >
          <TextField
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New project title…"
            fullWidth
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            variant="contained"
            sx={{ px: 3, flexShrink: 0 }}
          >
            {creating ? "Adding…" : "Add"}
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mx: 4, my: 1 }}>
          {error}
        </Alert>
      )}

      {/* View */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <Box sx={{ px: 4, py: 5 }}>
            <CircularProgress size={20} />
          </Box>
        ) : displayedProjects.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <Typography color="text.secondary">
              No {tab} projects found.
            </Typography>
          </Box>
        ) : (
          <ProjectTable
            projects={sorted}
            developers={devMap}
            isAdmin={isAdmin}
          />
        )}
      </Box>
    </Box>
  );
}
