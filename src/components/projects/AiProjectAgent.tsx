"use client";

// AI Project Agent — paste a project brief or timeline, and the agent generates
// a full project with a Task/Phase/Week structure (the same shape as the MARK
// sample). Review the plan, then create it in one click.

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/firebase/auth-context";
import { createProject } from "@/lib/data/projects";
import { generateProjectPlan, type GeneratedPlan } from "@/lib/ai/ai-agent";
import { AI_MODELS, DEFAULT_MODEL_ID, getModel } from "@/lib/ai/ai-models";

export function AiProjectAgent({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { user } = useAuth();
  const [brief, setBrief] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function generate() {
    const text = brief.trim();
    if (!text || generating) return;
    setGenerating(true);
    setError(null);
    setPlan(null);
    try {
      const result = await generateProjectPlan(text, modelId);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function create() {
    if (!plan || !user) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createProject(
        {
          title: plan.title,
          description: plan.description,
          status: "in_progress",
          priority: "medium",
        },
        user.uid,
        { columns: plan.columns, rows: plan.rows },
      );
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  // Resolve a row's Week option id to its label, and summarize counts per week.
  const weekOptions = plan?.columns.find((c) => c.id === "week")?.options ?? [];
  const weekLabel = (rowWeek: unknown) =>
    weekOptions.find((o) => o.id === rowWeek)?.label ?? "";
  const weekSummary: { week: string; count: number }[] = [];
  if (plan) {
    for (const r of plan.rows) {
      const label = weekLabel(r.cells.week);
      const last = weekSummary[weekSummary.length - 1];
      if (last && last.week === label) last.count++;
      else weekSummary.push({ week: label, count: 1 });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: { backdropFilter: "blur(4px)" } },
        paper: {
          sx: {
            maxHeight: "84vh",
            display: "flex",
            flexDirection: "column",
            mt: "8vh",
            alignSelf: "flex-start",
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          px: 2,
          py: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SparkIcon />
          <Typography variant="subtitle2">AI Project Agent</Typography>
        </Box>
        <TextField
          select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          sx={{ minWidth: 150, "& .MuiInputBase-input": { fontSize: 12, py: 0.75 } }}
        >
          {AI_MODELS.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Body */}
      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", p: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 0.5, display: "block", fontWeight: 500 }}
        >
          Project brief or timeline
        </Typography>
        <TextField
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          multiline
          minRows={6}
          fullWidth
          placeholder={
            "Paste a timeline, or describe the project. e.g.\n" +
            "\"Build a 4-week marketing site: week 1 design, week 2 build pages, week 3 CMS + blog, week 4 QA and launch.\""
          }
        />

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        {/* Preview */}
        {plan && (
          <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3, overflow: "hidden" }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, py: 1.5 }}>
              <Typography variant="subtitle2">{plan.title}</Typography>
              {plan.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {plan.description}
                </Typography>
              )}
              <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                <Chip
                  label={`${plan.rows.length} tasks`}
                  sx={{
                    bgcolor: "accentSoft",
                    color: "primary.main",
                    fontWeight: 500,
                    fontSize: 11,
                    height: 20,
                  }}
                />
                {weekSummary.map((w) => (
                  <Chip
                    key={w.week}
                    label={`${w.week}: ${w.count}`}
                    sx={{ bgcolor: "surface", fontSize: 11, height: 20, color: "text.secondary" }}
                  />
                ))}
              </Box>
            </Box>
            <Box component="ul" sx={{ m: 0, p: 0, maxHeight: 208, overflowY: "auto", listStyle: "none" }}>
              {plan.rows.map((r, i) => (
                <Box
                  component="li"
                  key={r.id}
                  sx={{
                    px: 2,
                    py: 1,
                    borderTop: i > 0 ? 1 : 0,
                    borderColor: "divider",
                  }}
                >
                  <Typography component="span" variant="body2">
                    {String(r.cells.name ?? "")}
                  </Typography>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: 11 }}>
                    · {String(r.cells.phase ?? "")} · {weekLabel(r.cells.week)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          {generating
            ? `Generating with ${getModel(modelId)?.label}…`
            : plan
              ? "Review the plan, then create the project."
              : "The agent will structure your brief into weeks & tasks."}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {plan ? (
            <>
              <Button
                onClick={generate}
                disabled={generating}
                variant="outlined"
                color="inherit"
                sx={{ borderColor: "divider", fontSize: 12 }}
              >
                Regenerate
              </Button>
              <Button
                onClick={create}
                disabled={creating}
                variant="contained"
                sx={{ px: 2.5, fontSize: 12 }}
              >
                {creating ? "Creating…" : "Create project"}
              </Button>
            </>
          ) : (
            <Button
              onClick={generate}
              disabled={generating || !brief.trim()}
              variant="contained"
              sx={{ px: 2.5, fontSize: 12 }}
            >
              {generating ? "Generating…" : "Generate plan"}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

function SparkIcon() {
  return (
    <Box
      component="svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      sx={{ color: "primary.main" }}
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </Box>
  );
}
