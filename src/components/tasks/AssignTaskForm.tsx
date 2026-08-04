"use client";

import { useState, useMemo } from "react";
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
import { useTheme } from "@mui/material/styles";

import { type NewTask } from "@/lib/data/tasks";
import { uploadTaskFile } from "@/lib/firebase/storage";
import { doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { overtimeCost, dailySalary } from "@/lib/utils/salaryMath";
import { DEFAULT_OFFICE_SETTINGS, type Employee, type Project } from "@/lib/data/types";
import { useCurrency } from "@/lib/contexts/CurrencyContext";
import { useAttendanceData } from "@/hooks/useAttendanceData";
import { computeMonthlySummary, formatODH } from "@/lib/data/attendance/calculations";

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
  const [resolvesODH, setResolvesODH] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const { formatCurrency } = useCurrency();
  const { records: attRecords, tasks: allTasks, settings: officeSettings } = useAttendanceData();

  const selectedEmp = employees.find((e) => e.id === assigneeId);
  const calculatedCost = isOvertime && !compensatesWeeklyHours && !resolvesODH && assignedHours > 0 
    ? overtimeCost(selectedEmp?.monthlySalary, assignedHours, date) 
    : 0;

  const liveBalances = useMemo(() => {
    if (!selectedEmp || !attRecords.length) {
      return { odhStr: "0h ODH", penaltyStr: "0" };
    }
    const targetMonthStr = date.slice(0, 7);
    const empRecords = attRecords.filter(
      (r) =>
        (r.uid === selectedEmp.id || r.uid === selectedEmp.uid) &&
        r.date.startsWith(targetMonthStr)
    );
    const empTasks = (allTasks || []).filter(
      (t) =>
        (t.assigneeId === selectedEmp.id || t.assigneeId === selectedEmp.uid) &&
        t.date.startsWith(targetMonthStr)
    );
    const summary = computeMonthlySummary(
      empRecords,
      empTasks,
      officeSettings || DEFAULT_OFFICE_SETTINGS,
      selectedEmp.accessLevel === "intern",
      selectedEmp,
      attRecords,
      targetMonthStr
    );
    const odhMins = summary.overtimeDueMinutes || 0;
    const odhStr = odhMins > 0 ? formatODH(odhMins) : "0h ODH";

    const isIntern = selectedEmp.accessLevel === "intern";
    const isPaid = Number(selectedEmp.monthlySalary) > 0;
    let penaltyStr = "0";
    if (isIntern || !isPaid) {
      const penaltyMins = summary.penaltyODHMinutes || 0;
      penaltyStr = `${penaltyMins > 0 ? formatODH(penaltyMins) : "0h ODH"}`;
    } else {
      const dDays = summary.deductionDays || 0;
      const [yStr, mStr] = date.split("-");
      const y = parseInt(yStr, 10) || new Date().getFullYear();
      const m = parseInt(mStr, 10) || new Date().getMonth() + 1;
      const dailyRate = dailySalary(Number(selectedEmp.monthlySalary) || 0, y, m);
      const cost = Math.round(dDays * dailyRate);
      penaltyStr = `${formatCurrency(cost)} (${dDays}d salary)`;
    }
    return { odhStr, penaltyStr };
  }, [selectedEmp, attRecords, allTasks, officeSettings, date, formatCurrency]);

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
        resolvesODH,
        overtimeCost: calculatedCost,
        attachments: uploadedFiles,
      });
      setTitle("");
      setDescription("");
      setAssignedHours(0);
      setIsOvertime(false);
      setCompensatesWeeklyHours(false);
      setResolvesODH(false);
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
              .filter((e) => e.accessLevel !== "admin" && (e.accessLevel as string) !== "owner")
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
        <Grid size={12}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              background: isOvertime
                ? isDark
                  ? "rgba(59, 130, 246, 0.1)"
                  : "rgba(59, 130, 246, 0.05)"
                : isDark
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.015)",
              border: 1,
              borderColor: isOvertime
                ? isDark
                  ? "rgba(59, 130, 246, 0.4)"
                  : "rgba(59, 130, 246, 0.4)"
                : "divider",
              backdropFilter: "blur(12px)",
              boxShadow: isOvertime
                ? isDark
                  ? "0 4px 16px rgba(59, 130, 246, 0.15)"
                  : "0 4px 16px rgba(59, 130, 246, 0.1)"
                : "none",
              transition: "all 0.3s ease",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={isOvertime}
                  onChange={(e) => setIsOvertime(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Mark as Overtime
                </Typography>
              }
            />

            {isOvertime && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1.5 }}>
                {/* Compensatory Task Sub-Toggle */}
                <Box
                  onClick={() => setCompensatesWeeklyHours(!compensatesWeeklyHours)}
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: { xs: 1, sm: 2 },
                    p: 1.5,
                    px: 2,
                    borderRadius: 2.5,
                    background: compensatesWeeklyHours
                      ? isDark
                        ? "rgba(168, 85, 247, 0.15)"
                        : "rgba(168, 85, 247, 0.08)"
                      : isDark
                        ? "rgba(255, 255, 255, 0.03)"
                        : "rgba(0, 0, 0, 0.02)",
                    backdropFilter: "blur(12px)",
                    border: 1,
                    borderColor: compensatesWeeklyHours
                      ? "secondary.main"
                      : "divider",
                    boxShadow: compensatesWeeklyHours
                      ? isDark
                        ? "0 0 16px rgba(168, 85, 247, 0.3)"
                        : "0 4px 14px rgba(168, 85, 247, 0.15)"
                      : "none",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={compensatesWeeklyHours}
                        onChange={(e) => setCompensatesWeeklyHours(e.target.checked)}
                        color="secondary"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                        Compensatory Task (clears penalties)
                      </Typography>
                    }
                    sx={{ m: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Chip
                    size="small"
                    label={`Remaining penalty: ${liveBalances.penaltyStr}`}
                    color={compensatesWeeklyHours ? "secondary" : "default"}
                    variant={compensatesWeeklyHours ? "filled" : "outlined"}
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      height: 24,
                    }}
                  />
                </Box>

                {/* Mark as ODH Sub-Toggle */}
                <Box
                  onClick={() => setResolvesODH(!resolvesODH)}
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: { xs: 1, sm: 2 },
                    p: 1.5,
                    px: 2,
                    borderRadius: 2.5,
                    background: resolvesODH
                      ? isDark
                        ? "rgba(59, 130, 246, 0.15)"
                        : "rgba(59, 130, 246, 0.08)"
                      : isDark
                        ? "rgba(255, 255, 255, 0.03)"
                        : "rgba(0, 0, 0, 0.02)",
                    backdropFilter: "blur(12px)",
                    border: 1,
                    borderColor: resolvesODH
                      ? "primary.main"
                      : "divider",
                    boxShadow: resolvesODH
                      ? isDark
                        ? "0 0 16px rgba(59, 130, 246, 0.3)"
                        : "0 4px 14px rgba(59, 130, 246, 0.15)"
                      : "none",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={resolvesODH}
                        onChange={(e) => setResolvesODH(e.target.checked)}
                        color="primary"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                        Mark as ODH (Overtime Due Hours)
                      </Typography>
                    }
                    sx={{ m: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Chip
                    size="small"
                    label={`Remaining ODH: ${liveBalances.odhStr}`}
                    color={resolvesODH ? "primary" : "default"}
                    variant={resolvesODH ? "filled" : "outlined"}
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      height: 24,
                    }}
                  />
                </Box>

                {!compensatesWeeklyHours && !resolvesODH && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    Est. Cost: {formatCurrency(calculatedCost)}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
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
