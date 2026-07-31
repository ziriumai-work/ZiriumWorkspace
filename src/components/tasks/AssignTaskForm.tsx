"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";

import { type NewTask } from "@/lib/data/tasks";
import { uploadTaskFile } from "@/lib/firebase/storage";
import { doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { overtimeCost } from "@/lib/utils/salaryMath";
import type { Employee, Project } from "@/lib/data/types";
import { useCurrency } from "@/lib/contexts/CurrencyContext";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AssignTaskForm({
  employees,
  projects,
  onAssign,
}: {
  employees: Employee[];
  projects: Project[];
  onAssign: (input: NewTask) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [assignedHours, setAssignedHours] = useState<number>(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [compensatesWeeklyHours, setCompensatesWeeklyHours] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency } = useCurrency();

  const selectedEmp = employees.find((e) => e.id === assigneeId);
  const calculatedCost = isOvertime && !compensatesWeeklyHours && assignedHours > 0 
    ? overtimeCost(selectedEmp?.monthlySalary, assignedHours, date) 
    : 0;

  async function assign() {
    if (!title.trim() || !assigneeId) {
      setError("A title and an assignee are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const proj = projects.find((p) => p.id === projectId);
      
      const newId = doc(collection(db, "tasks")).id;
      const uploadedFiles = [];
      if (files.length > 0) {
        for (const file of files) {
          uploadedFiles.push(await uploadTaskFile(newId, file));
        }
      }
      
      await onAssign({
        taskId: newId,
        title,
        description,
        assigneeId,
        assigneeName: selectedEmp?.name ?? "",
        projectId: proj?.id ?? null,
        projectTitle: proj?.title ?? null,
        date,
        assignedHours,
        isOvertime,
        compensatesWeeklyHours,
        overtimeCost: calculatedCost,
        attachments: uploadedFiles,
      });
      setTitle("");
      setDescription("");
      setAssignedHours(0);
      setIsOvertime(false);
      setCompensatesWeeklyHours(false);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, border: "1px solid", borderColor: "divider" }}>
      <Typography variant="body2" sx={{ mb: 2, fontWeight: 600, letterSpacing: "-0.01em" }}>
        Assign a task
      </Typography>
      <Grid container spacing={1.5}>
        <Grid size={12}>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            fullWidth
          />
        </Grid>
        <Grid size={12}>
          <TextField
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            multiline
            minRows={2}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            fullWidth
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">Assign to…</MenuItem>
            {employees
              .filter((e) => e.accessLevel !== "admin" && e.accessLevel !== "owner")
              .map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            fullWidth
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">One-time task (No project)</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.title}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Assigned Hours"
            type="number"
            value={assignedHours || ""}
            onChange={(e) => setAssignedHours(parseFloat(e.target.value) || 0)}
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }} sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <FormControlLabel
            control={<Switch checked={isOvertime} onChange={(e) => setIsOvertime(e.target.checked)} color="primary" />}
            label="Mark as Overtime"
          />
          {isOvertime && (
            <FormControlLabel
              control={<Switch checked={compensatesWeeklyHours} onChange={(e) => setCompensatesWeeklyHours(e.target.checked)} color="secondary" size="small" />}
              label={
                <Typography variant="caption" sx={{ lineHeight: 1 }}>
                  Count towards weekly hours completion
                </Typography>
              }
            />
          )}
          {isOvertime && !compensatesWeeklyHours && (
            <Typography variant="caption" color="text.secondary">
              Est. Cost: {formatCurrency(calculatedCost)}
            </Typography>
          )}
        </Grid>
        <Grid size={12} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button variant="outlined" component="label" sx={{ borderRadius: 2 }}>
              Attach Files
              <input 
                type="file" 
                multiple 
                hidden 
                onChange={(e) => {
                  if (e.target.files) {
                    const selected = Array.from(e.target.files);
                    setFiles(prev => [...prev, ...selected]);
                  }
                  e.target.value = '';
                }} 
              />
            </Button>
          </Box>
          {files.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
              {files.map((file, idx) => {
                const parts = file.name.split('.');
                const ext = parts.pop() || '';
                const base = parts.join('.');
                const shortName = base.split(/[\s-_]+/).slice(0, 3).join(' ') || base.substring(0, 15);
                return (
                  <Chip 
                    key={idx}
                    label={`${shortName}.${ext}`}
                    onDelete={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    size="small"
                    sx={{ bgcolor: "surface", border: "1px solid", borderColor: "divider" }}
                  />
                );
              })}
            </Box>
          )}
        </Grid>
        {error && (
          <Grid size={12}>
            <Typography color="error" variant="body2">{error}</Typography>
          </Grid>
        )}
        <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          <Button
            onClick={assign}
            disabled={saving}
            variant="contained"
            sx={{ px: 4, py: 1, borderRadius: 2 }}
          >
            {saving ? "Assigning…" : "Assign task"}
          </Button>
        </Grid>
      </Grid>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}
