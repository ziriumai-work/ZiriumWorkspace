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
import { Money } from "@/components/finance/Money";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { chipSx } from "@/components/projectMeta";
import { amber, green } from "@/lib/theme/colors";
import {
  addFinanceProject,
  deleteFinanceProject,
  pendingOf,
  subscribeToFinanceProjects,
  updateFinanceProject,
  type FinanceProject,
  type FinanceProjectStatus,
} from "@/lib/data/finance";

export default function FinanceProjectsPage() {
  const [projects, setProjects] = useState<FinanceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FinanceProject | null>(null);

  // Add-project form.
  const [name, setName] = useState("");
  const [worth, setWorth] = useState("");
  const [received, setReceived] = useState("");
  const [milestones, setMilestones] = useState("");
  const [status, setStatus] = useState<FinanceProjectStatus>("ongoing");
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

  const totals = useMemo(() => {
    const worthSum = projects.reduce((s, p) => s + p.worth, 0);
    const receivedSum = projects.reduce((s, p) => s + p.received, 0);
    return { worthSum, receivedSum, pendingSum: worthSum - receivedSum };
  }, [projects]);

  async function add() {
    if (!name.trim()) {
      setError("A project name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addFinanceProject({
        name: name.trim(),
        worth: Number(worth) || 0,
        received: Number(received) || 0,
        milestoneCount: Number(milestones) || 0,
        status,
      });
      setName("");
      setWorth("");
      setReceived("");
      setMilestones("");
      setStatus("ongoing");
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
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
          Add a project
        </Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              label="Project name *"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <TextField
              value={worth}
              onChange={(e) => setWorth(e.target.value)}
              label="Worth"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <TextField
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              label="Received"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <TextField
              value={milestones}
              onChange={(e) => setMilestones(e.target.value)}
              label="Milestones"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 1.5 }}>
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
          <Grid size={{ xs: 6, sm: 3, lg: 1.5 }} sx={{ display: "flex", alignItems: "center" }}>
            <Button onClick={add} disabled={saving} variant="contained" fullWidth>
              {saving ? "Adding…" : "Add"}
            </Button>
          </Grid>
        </Grid>
        {(Number(worth) || 0) > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Pending is calculated automatically: worth − received ={" "}
            <Money
              value={(Number(worth) || 0) - (Number(received) || 0)}
              variant="caption"
            />
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Totals strip */}
      <Box sx={{ mt: 3, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <Typography variant="subtitle2">
          {projects.length} {projects.length === 1 ? "project" : "projects"} total
        </Typography>
        <Box sx={{ display: "flex", gap: 2, ml: "auto", flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary">
            Worth <Money value={totals.worthSum} variant="caption" />
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Received <Money value={totals.receivedSum} balance variant="caption" />
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pending{" "}
            <Money
              value={totals.pendingSum}
              variant="caption"
              sx={{ color: totals.pendingSum > 0 ? "warning.main" : "success.main" }}
            />
          </Typography>
        </Box>
      </Box>

      {/* Editable list */}
      <Paper variant="outlined" sx={{ mt: 1.5, borderRadius: 3, overflowX: "auto" }}>
        <Table sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "surface" }}>
              <TableCell>Name</TableCell>
              <TableCell align="right">Worth</TableCell>
              <TableCell align="right">Received</TableCell>
              <TableCell align="right">Pending</TableCell>
              <TableCell align="right">Milestones</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <CircularProgress size={18} />
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No projects yet. Add your first one above.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  sx={{
                    "& .row-actions": { opacity: 0 },
                    "&:hover .row-actions": { opacity: 1 },
                  }}
                >
                  <TableCell sx={{ minWidth: 180 }}>
                    <EditableText
                      value={p.name}
                      onCommit={(v) =>
                        v.trim() && updateFinanceProject(p.id, { name: v.trim() })
                      }
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>
                    <EditableNumber
                      value={p.worth}
                      onCommit={(v) => updateFinanceProject(p.id, { worth: v })}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>
                    <EditableNumber
                      value={p.received}
                      onCommit={(v) => updateFinanceProject(p.id, { received: v })}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>
                    <Money
                      value={pendingOf(p)}
                      variant="body2"
                      sx={{ color: pendingOf(p) > 0 ? "warning.main" : "success.main" }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 110 }}>
                    <EditableNumber
                      value={p.milestoneCount}
                      onCommit={(v) =>
                        updateFinanceProject(p.id, { milestoneCount: Math.round(v) })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ width: 140 }}>
                    <Select
                      value={p.status}
                      onChange={(e) =>
                        updateFinanceProject(p.id, {
                          status: e.target.value as FinanceProjectStatus,
                        })
                      }
                      variant="standard"
                      disableUnderline
                      renderValue={(v) => (
                        <Chip
                          label={v === "ongoing" ? "Ongoing" : "Completed"}
                          sx={[
                            chipSx(v === "ongoing" ? amber.main : green.main),
                            { height: 20, fontSize: 11 },
                          ]}
                        />
                      )}
                      sx={{ "& .MuiSelect-select": { py: 0.25 } }}
                    >
                      <MenuItem value="ongoing">Ongoing</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell align="right" sx={{ width: 60 }}>
                    <IconButton
                      className="row-actions"
                      size="small"
                      onClick={() => setToDelete(p)}
                      sx={{
                        color: "text.secondary",
                        transition: "opacity 0.15s",
                        "&:hover": { color: "error.main" },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

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
        onClose={() => setToast(null)}
      />
    </Box>
  );
}

// Inline text editor: buffers locally, writes on blur/Enter.
function EditableText({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
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
      sx={{ fontSize: 14, fontWeight: 500 }}
    />
  );
}

// Inline number editor with the same buffer-on-blur behavior.
function EditableNumber({
  value,
  onCommit,
}: {
  value: number;
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
    />
  );
}
