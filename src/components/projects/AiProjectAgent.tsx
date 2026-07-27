"use client";

import { useState, useEffect } from "react";
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
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { generateTableImport } from "@/lib/ai/ai-agent";
import { AI_MODELS, DEFAULT_MODEL_ID, getModel } from "@/lib/ai/ai-models";
import type { Project, DbColumn, DbRow } from "@/lib/data/types";
import { useUpload } from "@/lib/contexts/UploadContext";

export function AiProjectAgent({
  open,
  projects = [],
  onClose,
  onCreated,
}: {
  open: boolean;
  projects?: Project[];
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { user } = useAuth();
  const { uploadFile } = useUpload();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<{ columns: DbColumn[]; rows: DbRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [open, projects]);

  if (!open) return null;

  async function generate() {
    if (!file || !prompt.trim() || !selectedProjectId || generating) return;
    setGenerating(true);
    setError(null);
    setPlan(null);
    try {
      // Show upload progress UI as requested
      if (user) {
        try {
          const path = `temp/ai-imports/${user.uid}/${Date.now()}-${file.name}`;
          await uploadFile(path, file);
        } catch (e) {
           console.log("Upload progress tracking skipped", e);
        }
      }

      // 1. Parse File via API route
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: formData });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to parse file.");
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 2. Generate table using DeepSeek
      const result = await generateTableImport(data.text, prompt, modelId);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function create() {
    if (!plan || !user || !selectedProjectId) return;
    setCreating(true);
    setError(null);
    try {
      await updateDoc(doc(db, "projects", selectedProjectId), {
        columns: plan.columns,
        rows: plan.rows,
      });
      onCreated(selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import table.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <img src="/logo.png" alt="Zirium AI" style={{ width: 20, height: 20, borderRadius: 4 }} />
          <Typography variant="subtitle2">AI Table Import</Typography>
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
        {!plan ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              Select Project
            </Typography>
            <TextField
              select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              fullWidth
              sx={{ mb: 2, "& .MuiInputBase-input": { fontSize: 14 } }}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.title}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              Upload Document (PDF, DOCX, CSV, TXT)
            </Typography>
            <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
              <Button
                variant="contained"
                component="label"
                sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}
              >
                Choose File
                <input
                  type="file"
                  hidden
                  accept=".txt,.csv,.md,.json,.pdf,.doc,.docx"
                  onChange={(e: any) => setFile(e.target.files?.[0] || null)}
                />
              </Button>
              {file && (
                <Typography variant="body2" color="text.primary">
                  {file.name}
                </Typography>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              Prompt / Instructions
            </Typography>
            <TextField
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              placeholder={
                "e.g., 'Generate exact same number of columns and headings as the document, and add a status col'"
              }
            />
          </>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Generated Schema Preview</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {plan.columns.map(c => (
                <Chip key={c.id} label={`${c.name} (${c.type})`} sx={{ bgcolor: "surface" }} />
              ))}
            </Box>
            <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 3 }}>
              <Box sx={{ maxHeight: 300, overflowY: "auto", overflowX: "auto" }}>
                {/* Table Header */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${plan.columns.length}, minmax(180px, 1fr))`,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "surface",
                  }}
                >
                  {plan.columns.map((c) => (
                    <Box key={c.id} sx={{ px: 2, py: 1.5, borderRight: 1, borderColor: "divider" }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        {c.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {/* Table Body */}
                {plan.rows.map((r, i) => (
                  <Box
                    key={r.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${plan.columns.length}, minmax(180px, 1fr))`,
                      borderBottom: i < plan.rows.length - 1 ? 1 : 0,
                      borderColor: "divider",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    {plan.columns.map((c) => {
                      let display = r.cells[c.id] || "";
                      if (c.type === "select" || c.type === "status") {
                        const opt = c.options?.find((o) => o.id === display);
                        display = opt?.label || display;
                      }
                      return (
                        <Box
                          key={c.id}
                          sx={{
                            px: 2,
                            py: 1.5,
                            borderRight: 1,
                            borderColor: "divider",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "flex",
                          }}
                        >
                          <Typography variant="body2" noWrap title={String(display ?? "")}>
                            {display}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          {generating
            ? `Generating with ${getModel(modelId)?.label}…`
            : plan
              ? "Review the generated table schema, then apply it to the project. THIS WILL REPLACE EXISTING TASKS."
              : "Upload a document to automatically populate the project table."}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {plan ? (
            <>
              <Button
                onClick={() => setPlan(null)}
                disabled={creating}
                variant="outlined"
                color="inherit"
                sx={{ borderColor: "divider", fontSize: 12 }}
              >
                Back
              </Button>
              <Button onClick={create} disabled={creating} variant="contained" color="error" sx={{ px: 2.5, fontSize: 12 }}>
                {creating ? "Applying…" : "Replace Table"}
              </Button>
            </>
          ) : (
            <Button
              onClick={generate}
              disabled={generating || !prompt.trim() || !file || !selectedProjectId}
              variant="contained"
              sx={{ px: 2.5, fontSize: 12 }}
            >
              {generating ? "Parsing…" : "Generate Table"}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
