"use client";

// Finance → Projects: add commercial projects (name, worth, received,
// milestones, status) and edit any of them inline at any time. Every change
// writes straight to Firestore, so the dashboard, monthly sheet, and any other
// open session update in real time.

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import { Money } from "@/components/finance/Money";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { chipSx } from "@/components/projectMeta";
import { amber, green } from "@/lib/theme/colors";
import {
  addFinanceProject,
  deleteFinanceProject,
  currencySymbol,
  pendingOf,
  subscribeToFinanceProjects,
  updateFinanceProject,
  type FinanceProject,
  type FinanceProjectStatus,
} from "@/lib/data/finance";
import { updateProject, getProject } from "@/lib/data/projects";
import { defaultColumns } from "@/lib/firebase/db";
import { serverTimestamp, setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useUpload } from "@/lib/contexts/UploadContext";
import { useAuth } from "@/lib/firebase/auth-context";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import SyncIcon from "@mui/icons-material/Sync";
import { red } from "@mui/material/colors";
import { type AlertColor } from "@mui/material/Alert";

export default function FinanceProjectsPage() {
  const { user } = useAuth();
  const { uploadFile } = useUpload();
  const [projects, setProjects] = useState<FinanceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<AlertColor>("success");
  const [toDelete, setToDelete] = useState<FinanceProject | null>(null);

  // Add-project form.
  const [name, setName] = useLocalStorage("zirium_draft_project_name", "");
  const [worth, setWorth] = useLocalStorage("zirium_draft_project_worth", "");
  const [received, setReceived] = useLocalStorage("zirium_draft_project_received", "");
  const [milestones, setMilestones] = useLocalStorage("zirium_draft_project_milestones", "");
  const [status, setStatus] = useLocalStorage<FinanceProjectStatus>("zirium_draft_project_status", "ongoing");
  const [currency, setCurrency] = useLocalStorage("zirium_draft_project_currency", "PKR");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeToFinanceProjects(
      (p) => {
        setProjects(p);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  async function add() {
    if (!name.trim()) {
      setError("A project name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await addFinanceProject({
        name: name.trim(),
        worth: Number(worth) || 0,
        received: Number(received) || 0,
        milestoneCount: Number(milestones) || 0,
        status,
        currency,
        files: [],
      }, user!.uid);

      if (selectedFiles.length > 0) {
        const uploaded = await Promise.all(
          selectedFiles.map((f) => uploadFile(`financeProjects/${id}/${Date.now()}-${f.name}`, f))
        );
        await updateFinanceProject(id, { files: uploaded });
      }

      setName("");
      setWorth("");
      setReceived("");
      setMilestones("");
      setStatus("ongoing");
      setCurrency("PKR");
      setSelectedFiles([]);
      setToast("Project added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add project");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteFinanceProject(toDelete.id);
    setToDelete(null);
    setToast("Project deleted");
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 4 }}>
      {/* Add a project */}
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, mb: 4, bgcolor: "surface" }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Create New Project
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              label="Project name *"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              label="Currency"
              fullWidth
            >
              <MenuItem value="PKR">PKR</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
              <MenuItem value="GBP">GBP</MenuItem>
              <MenuItem value="AED">AED</MenuItem>
              <MenuItem value="SAR">SAR</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              value={status}
              onChange={(e) => setStatus(e.target.value as FinanceProjectStatus)}
              label="Status"
              fullWidth
            >
              <MenuItem value="ongoing">Ongoing</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              value={worth}
              onChange={(e) => setWorth(e.target.value)}
              label="Worth"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              label="Received"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              value={milestones}
              onChange={(e) => setMilestones(e.target.value)}
              label="Milestones"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
                Attach Documents
                <input
                  type="file"
                  hidden
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      const duplicates = newFiles.filter((nf) => selectedFiles.some((f) => f.name === nf.name));
                      if (duplicates.length > 0) {
                        setToastType("error");
                        setToast(`File(s) already added: ${duplicates.map(f => f.name).join(", ")}`);
                      }
                      const validFiles = newFiles.filter((nf) => !selectedFiles.some((f) => f.name === nf.name));
                      setSelectedFiles((prev) => [...prev, ...validFiles]);
                    }
                    e.target.value = '';
                  }}
                />
              </Button>
              {selectedFiles.map((f, i) => (
                <Chip
                  key={i}
                  label={f.name}
                  onDelete={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </Box>
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              {(Number(worth) || 0) > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Pending:{" "}
                  <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: (Number(worth) || 0) - (Number(received) || 0) > 0 ? "warning.main" : "success.main" }}>
                    {currencySymbol(currency)} {((Number(worth) || 0) - (Number(received) || 0)).toLocaleString()}
                  </Typography>
                </Typography>
              )}
            </Box>
            <Button onClick={add} disabled={saving} variant="contained" sx={{ px: 4, py: 1 }}>
              {saving ? "Creating…" : "Create Project"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {projects.length} {projects.length === 1 ? "Project" : "Projects"}
      </Typography>

      {/* Editable list as Cards */}
      {loading ? (
        <CircularProgress size={24} sx={{ mt: 4 }} />
      ) : projects.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          No projects yet. Add your first one above.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {projects.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 1 }}>
                  <IconButton
                    size="small"
                    title="Restore App Workspace"
                    onClick={async () => {
                      try {
                        const existing = await getProject(p.id);
                        if (!existing) {
                          await setDoc(doc(db, "projects", p.id), {
                            title: p.name,
                            description: "",
                            status: "planned",
                            priority: "medium",
                            assigneeUid: null,
                            teamId: null,
                            dueDate: null,
                            order: Date.now(),
                            developerIds: [],
                            projectRoles: {},
                            columns: defaultColumns(),
                            rows: [],
                            financeFiles: p.files ?? [],
                            createdBy: user?.uid ?? "",
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                          setToastType("success");
                          setToast("App Workspace restored!");
                        } else {
                          setToastType("error");
                          setToast("App Workspace already exists.");
                        }
                      } catch (err) {
                        setToastType("error");
                        setToast("Failed to restore workspace.");
                      }
                    }}
                    sx={{ color: "text.secondary", "&:hover": { color: "primary.main", bgcolor: "primary.50" } }}
                  >
                    <SyncIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setToDelete(p)}
                    sx={{
                      color: "text.secondary",
                      "&:hover": { color: "error.main", bgcolor: "error.50" },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
                <Box sx={{ pr: 10, mb: 2 }}>
                    <EditableText
                      value={p.name}
                      onCommit={(v) => v.trim() && updateFinanceProject(p.id, { name: v.trim() })}
                      sx={{ 
                        fontSize: 16,
                        fontWeight: 600, 
                        color: "primary.main",
                        textShadow: "0 0 8px rgba(0, 229, 255, 0.4)",
                      }}
                    />
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flexGrow: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">Worth</Typography>
                    <Box sx={{ width: 120 }}>
                      <EditableNumber
                        value={p.worth}
                        currency={p.currency}
                        onCommit={(v) => updateFinanceProject(p.id, { worth: v })}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">Received</Typography>
                    <Box sx={{ width: 120 }}>
                      <EditableNumber
                        value={p.received}
                        currency={p.currency}
                        onCommit={(v) => updateFinanceProject(p.id, { received: v })}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">Pending</Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: pendingOf(p) > 0 ? "warning.main" : "success.main" }}
                    >
                      {currencySymbol(p.currency)} {pendingOf(p).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">Milestones</Typography>
                    <Box sx={{ width: 60 }}>
                      <EditableNumber
                        value={p.milestoneCount}
                        onCommit={(v) => updateFinanceProject(p.id, { milestoneCount: Math.round(v) })}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: "auto", pt: 1 }}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Select
                      value={p.status}
                      onChange={(e) => updateFinanceProject(p.id, { status: e.target.value as FinanceProjectStatus })}
                      variant="standard"
                      disableUnderline
                      renderValue={(v) => (
                        <Chip
                          label={v === "ongoing" ? "Ongoing" : "Completed"}
                          sx={[
                            chipSx(v === "ongoing" ? amber.main : green.main),
                            { height: 24, fontSize: 12, fontWeight: 500 },
                          ]}
                        />
                      )}
                      sx={{ "& .MuiSelect-select": { py: 0.25 } }}
                    >
                      <MenuItem value="ongoing">Ongoing</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                    </Select>
                  </Box>
                  <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>Attachments</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {p.files?.map((f, i) => (
                        <Chip
                          key={i}
                          label={f.name}
                          size="small"
                          component="a"
                          href={f.url}
                          target="_blank"
                          clickable
                          onDelete={async (e) => {
                            e.preventDefault();
                            const newFiles = [...p.files!];
                            newFiles.splice(i, 1);
                            await updateFinanceProject(p.id, { files: newFiles });
                            await updateProject(p.id, { financeFiles: newFiles }).catch(() => {});
                          }}
                        />
                      ))}
                      <Button component="label" size="small" variant="text" startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />} sx={{ fontSize: 12, py: 0, minHeight: 24 }}>
                        Add File
                        <input
                          type="file"
                          hidden
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (p.files?.some(f => f.name === file.name)) {
                              setToastType("error");
                              setToast(`File "${file.name}" is already uploaded.`);
                              e.target.value = '';
                              return;
                            }
                            try {
                              const uploaded = await uploadFile(`financeProjects/${p.id}/${Date.now()}-${file.name}`, file);
                              const newFiles = [...(p.files || []), uploaded];
                              await updateFinanceProject(p.id, { files: newFiles });
                              await updateProject(p.id, { financeFiles: newFiles }).catch(() => {});
                            } catch (err) {
                              console.error(err);
                            }
                            e.target.value = '';
                          }}
                        />
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete project"
        message={`Delete "${toDelete?.name}" from finance? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      <Toast
        open={Boolean(toast)}
        message={toast ?? ""}
        type={toastType}
        onClose={() => setToast(null)}
      />
    </Box>
  );
}

// Inline text editor: buffers locally, writes on blur/Enter.
function EditableText({
  value,
  onCommit,
  sx,
}: {
  value: string;
  onCommit: (v: string) => void;
  sx?: any;
}) {
  const [draft, setDraft] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(value);
  }
  return (
    <InputBase
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      fullWidth
      sx={{ fontSize: 14, fontWeight: 500, ...sx }}
    />
  );
}

// Inline number editor with the same buffer-on-blur behavior.
function EditableNumber({
  value,
  currency,
  onCommit,
}: {
  value: number;
  currency?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(String(value));
  }
  return (
    <InputBase
      value={draft}
      type="number"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft) || 0;
        if (n !== value) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      fullWidth
      sx={{
        fontSize: 14,
        "& input": { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      }}
      endAdornment={
        currency && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {currency}
          </Typography>
        )
      }
    />
  );
}
