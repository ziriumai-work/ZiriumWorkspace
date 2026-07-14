"use client";

// Project detail page — the "open as page" experience. Title, properties, and
// notes are all editable and persist to Firestore. In v16 the route `params`
// arrive as a Promise, so we unwrap them with React's `use()`.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  subscribeToProject,
  updateProject,
  deleteProject,
} from "@/lib/data/projects";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { migrateTasksToDb } from "@/lib/firebase/db";
import { useAi } from "@/components/ai/AiProvider";
import { useAuth } from "@/lib/firebase/auth-context";
import { NotionTable } from "@/components/projects/NotionTable";
import { ProjectDevelopers } from "@/components/projects/ProjectDevelopers";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Developer } from "@/lib/data/types";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/data/types";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { openAi } = useAi();
  const { isAdmin, employee } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);

  // Local draft state for the free-typing fields (title, notes) so we don't
  // write to Firestore on every keystroke — we save on blur.
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToProject(
      id,
      (p) => {
        setProject(p);
        if (p) {
          setTitle(p.title);
          setNotes(p.description);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    const unsubDevs = subscribeToDevelopers(setDevelopers);
    return () => {
      unsub();
      unsubDevs();
    };
  }, [id]);

  // One-time migration: older projects stored a fixed `tasks` list. Convert it
  // into the columns/rows database the first time such a project is opened.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!project || migratedRef.current) return;
    if (
      project.rows.length === 0 &&
      project.tasks &&
      project.tasks.length > 0
    ) {
      migratedRef.current = true;
      updateProject(id, migrateTasksToDb(project.tasks));
    }
  }, [project, id]);

  if (loading) {
    return (
      <Box sx={{ px: 4, py: 5 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ px: 4, py: 5 }}>
        <Typography variant="body2" color="text.secondary">
          Project not found.
        </Typography>
        <MuiLink
          component={Link}
          href="/projects"
          variant="body2"
          sx={{ mt: 1, display: "inline-block" }}
        >
          ← Back to Projects
        </MuiLink>
      </Box>
    );
  }

  // Access guard: employees may only open projects they're assigned to.
  if (!isAdmin && (!employee || !project.developerIds.includes(employee.id))) {
    return (
      <Box sx={{ px: 4, py: 5 }}>
        <Typography variant="body2" color="text.secondary">
          You don’t have access to this project.
        </Typography>
        <MuiLink
          component={Link}
          href="/projects"
          variant="body2"
          sx={{ mt: 1, display: "inline-block" }}
        >
          ← Back to Projects
        </MuiLink>
      </Box>
    );
  }

  const dueValue = project.dueDate
    ? project.dueDate.toDate().toISOString().slice(0, 10)
    : "";

  // Compact, structured context the AI can reason about for this project.
  const taskList = project.rows
    .map((r) => `- ${String(r.cells.name ?? "")}`)
    .filter((l) => l.trim() !== "-")
    .join("\n");
  const projectContext = [
    `Project: ${project.title}`,
    `Status: ${project.status}`,
    `Priority: ${project.priority}`,
    `Due: ${dueValue || "none"}`,
    `Notes: ${project.description || "(empty)"}`,
    project.rows.length ? `\nTasks (${project.rows.length}):\n${taskList}` : "",
  ].join("\n");

  const AI_SYSTEM =
    "You are an assistant inside a company project workspace. Be concise, " +
    "professional, and practical. Use clear formatting (short paragraphs or " +
    "bullet points). Base answers on the provided project context.";

  // Append AI output into the notes field and persist.
  function insertIntoNotes(text: string) {
    const next = notes.trim() ? `${notes.trim()}\n\n${text}` : text;
    setNotes(next);
    updateProject(id, { description: next });
  }

  const aiActions: { label: string; prompt: string }[] = [
    {
      label: "Summarize",
      prompt: `Summarize this project in 2-3 sentences.\n\n${projectContext}`,
    },
    {
      label: "Draft status update",
      prompt: `Write a short status update for stakeholders about this project.\n\n${projectContext}`,
    },
    {
      label: "Next steps",
      prompt: `Suggest a concise, prioritized list of next steps for this project.\n\n${projectContext}`,
    },
  ];

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 4 }}>
      <MuiLink
        component={Link}
        href="/projects"
        variant="caption"
        color="text.secondary"
        underline="hover"
      >
        ← Projects
      </MuiLink>

      {/* Title */}
      <InputBase
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const t = title.trim();
          if (t && t !== project.title) updateProject(id, { title: t });
        }}
        placeholder="Untitled"
        fullWidth
        sx={{
          mt: 1.5,
          fontSize: "1.875rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      />

      {/* Properties */}
      <Box
        component="dl"
        sx={{
          mt: 3,
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          alignItems: "start",
          rowGap: 1.5,
          m: 0,
          mb: 0,
          fontSize: 14,
        }}
      >
        <PropRow label="Status">
          <Select
            value={project.status}
            onChange={(e) =>
              updateProject(id, { status: e.target.value as ProjectStatus })
            }
            sx={{ fontSize: 14, minWidth: 150 }}
          >
            {PROJECT_STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </PropRow>

        <PropRow label="Priority">
          <Select
            value={project.priority}
            onChange={(e) =>
              updateProject(id, {
                priority: e.target.value as ProjectPriority,
              })
            }
            sx={{ fontSize: 14, minWidth: 150 }}
          >
            {PROJECT_PRIORITIES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </PropRow>

        <PropRow label="Assigned to">
          <ProjectDevelopers
            developerIds={project.developerIds}
            roster={developers}
            editable={isAdmin}
            onChange={(ids) => updateProject(id, { developerIds: ids })}
          />
        </PropRow>

        <PropRow label="Due date">
          <TextField
            type="date"
            value={dueValue}
            onChange={(e) =>
              updateProject(id, {
                dueDate: e.target.value
                  ? Timestamp.fromDate(new Date(e.target.value))
                  : null,
              })
            }
            sx={{ maxWidth: 180 }}
          />
        </PropRow>
      </Box>

      {/* Database (Notion-style table) */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label="Table"
            variant="outlined"
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18" />
              </svg>
            }
            sx={{ bgcolor: "surface", border: 0, fontWeight: 500 }}
          />
          <Typography variant="caption" color="text.secondary">
            {project.rows.length} rows
          </Typography>
        </Box>
        <NotionTable
          columns={project.columns}
          rows={project.rows}
          onColumnsChange={(cols) => updateProject(id, { columns: cols })}
          onRowsChange={(rws) => updateProject(id, { rows: rws })}
        />
      </Box>

      {/* AI actions (admin-only, like the rest of the AI surface) */}
      {isAdmin && (
        <Box
          sx={{
            mt: 4,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              mr: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontWeight: 500,
              color: "primary.main",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            </svg>
            AI
          </Typography>
          {aiActions.map((a) => (
            <Button
              key={a.label}
              onClick={() =>
                openAi({
                  title: a.label,
                  prompt: a.prompt,
                  system: AI_SYSTEM,
                  autoRun: true,
                  insertLabel: "Insert into notes",
                  onInsert: insertIntoNotes,
                })
              }
              variant="outlined"
              color="inherit"
              sx={{ borderColor: "divider", fontSize: 12 }}
            >
              {a.label}
            </Button>
          ))}
        </Box>
      )}

      {/* Notes */}
      <Box sx={{ mt: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            mb: 1,
            display: "block",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Notes
        </Typography>
        <TextField
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== project.description)
              updateProject(id, { description: notes });
          }}
          multiline
          minRows={10}
          placeholder="Write anything about this project…"
          fullWidth
        />
      </Box>

      {/* Danger zone */}
      <Divider sx={{ mt: 5 }} />
      <Box sx={{ pt: 2 }}>
        <Button
          color="error"
          onClick={() => setDeleteDialogOpen(true)}
          sx={{ fontWeight: 400 }}
        >
          Delete project
        </Button>
      </Box>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Project"
        message={`Delete "${project.title}"? This cannot be undone.`}
        type="error"
        confirmLabel="Delete Project"
        onConfirm={() => {
          deleteProject(id).then(() => {
            setDeleteDialogOpen(false);
            router.replace("/projects");
          });
        }}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0 }}>
        {children}
      </Box>
    </>
  );
}
