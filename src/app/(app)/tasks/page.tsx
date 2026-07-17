"use client";

// Tasks. Admins assign dated tasks to employees and see everything; employees
// see only their own tasks and submit a report (text + links + files) per task.

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Collapse,
  Divider,
} from "@mui/material";
import MuiLink from "@mui/material/Link";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  createTask,
  deleteTask,
  subscribeToAllTasks,
  subscribeToTasksForEmployee,
  updateTask,
  type NewTask,
} from "@/lib/data/tasks";
import { uploadTaskFile } from "@/lib/firebase/storage";
import { doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { overtimeCost } from "@/lib/utils/salaryMath";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { subscribeToProjects } from "@/lib/data/projects";
import { TaskReportEditor } from "@/components/tasks/TaskReportEditor";
import { TASK_STATUS_COLORS } from "@/components/projectMeta";
import { PillSelect } from "@/components/ui/PillSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DAILY_TASK_STATUSES,
  type DailyTask,
  type DailyTaskStatus,
  type Employee,
  type Project,
  type TaskReport,
} from "@/lib/data/types";

import { useCurrency } from "@/lib/contexts/CurrencyContext";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksPage() {
  const { user, employee, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to the right task set for the role.
  useEffect(() => {
    if (isAdmin) {
      return subscribeToAllTasks(
        (t) => {
          setTasks(t);
          setLoading(false);
        },
        () => setLoading(false),
      );
    }
    if (employee) {
      return subscribeToTasksForEmployee(
        employee.id,
        (t) => {
          setTasks(t);
          setLoading(false);
        },
        () => setLoading(false),
      );
    }
    // Neither resolved yet — stay in the loading state until a role is known.
  }, [isAdmin, employee]);

  // Admin needs employees (assignee picker) and projects (optional link).
  useEffect(() => {
    if (!isAdmin) return;
    const u1 = subscribeToDevelopers(setEmployees);
    const u2 = subscribeToProjects(setProjects);
    return () => {
      u1();
      u2();
    };
  }, [isAdmin]);

  // Group tasks by date (already sorted newest-first).
  const groups = useMemo(() => {
    const out: { date: string; items: DailyTask[] }[] = [];
    for (const t of tasks) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [tasks]);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 860, px: 4, py: 5 }}>
      <Box component="header" sx={{ mb: 3 }}>
        <Typography variant="h1">{isAdmin ? "Tasks" : "My Tasks"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {isAdmin
            ? "Assign daily tasks to employees and track their reports."
            : "Your assigned tasks. Update status and submit a report for each."}
        </Typography>
      </Box>

      {isAdmin && (
        <AssignTaskForm
          employees={employees}
          projects={projects}
          onAssign={(input) => createTask(input, user?.uid ?? "")}
        />
      )}

      <Box sx={{ mt: 3 }}>
        {loading ? (
          <CircularProgress size={20} />
        ) : groups.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              px: 2,
              py: 4,
              textAlign: "center",
              borderRadius: 3,
              borderStyle: "dashed",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {isAdmin
                ? "No tasks yet. Assign one above."
                : "You have no tasks yet."}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {groups.map((g) => (
              <Box component="section" key={g.date}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    display: "block",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {g.date}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {g.items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      showAssignee={isAdmin}
                      canEdit={isAdmin || employee?.id === t.assigneeId}
                      canDelete={isAdmin}
                      currentUser={{
                        uid: user?.uid ?? "",
                        name: employee?.name ?? user?.displayName ?? "User",
                        isAdmin,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function AssignTaskForm({
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
  const calculatedCost = isOvertime && assignedHours > 0 
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
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
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
            {employees.map((e) => (
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
            sx={{
              "& .MuiOutlinedInput-root": {
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  boxShadow: "0 0 12px var(--mui-palette-primary-main)",
                  borderColor: "var(--mui-palette-primary-main)",
                },
                "&.Mui-focused": {
                  boxShadow: "0 0 16px var(--mui-palette-primary-main)",
                }
              }
            }}
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
                  e.target.value = ''; // reset to allow picking same file again
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

function TaskCard({
  task,
  showAssignee,
  canEdit,
  canDelete,
  currentUser,
}: {
  task: DailyTask;
  showAssignee: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUser: { uid: string; name: string; isAdmin: boolean };
}) {
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const reportsCount = task.reports ? task.reports.length : (task.report.text || task.report.links.length || task.report.files.length ? 1 : 0);
  const hasReport = reportsCount > 0;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 2, py: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {task.title}
          </Typography>
          {task.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {task.description}
            </Typography>
          )}
          <Box
            sx={{
              mt: 0.75,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            {showAssignee && (
              <Chip
                label={task.assigneeName || "Unassigned"}
                sx={{
                  bgcolor: "accentSoft",
                  color: "primary.main",
                  fontWeight: 500,
                  fontSize: 11,
                  height: 20,
                }}
              />
            )}
            {task.projectTitle && (
              <Chip
                label={task.projectTitle}
                sx={{ bgcolor: "surface", fontSize: 11, height: 20 }}
              />
            )}
            {!!task.assignedHours && task.assignedHours > 0 && (
              <Chip
                label={`${task.assignedHours}h assigned`}
                sx={{ bgcolor: "surface", fontSize: 11, height: 20 }}
              />
            )}
            {task.isOvertime && (
              <Chip
                label={`Overtime (${formatCurrency(task.overtimeCost || 0)})`}
                sx={{ bgcolor: "#ef444422", color: "#ef4444", fontWeight: 500, fontSize: 11, height: 20 }}
              />
            )}
            {task.attachments && task.attachments.length > 0 && (
              <Chip
                label={`${task.attachments.length} doc(s)`}
                sx={{ bgcolor: "surface", fontSize: 11, height: 20, cursor: "pointer" }}
                onClick={() => setOpen(true)}
              />
            )}
            <MuiLink
              component="button"
              variant="caption"
              color="text.secondary"
              underline="hover"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide updates" : hasReport ? `View ${reportsCount} update${reportsCount > 1 ? "s" : ""}` : "Add update"}
            </MuiLink>
          </Box>
        </Box>

        <PillSelect
          value={task.status}
          options={DAILY_TASK_STATUSES}
          color={TASK_STATUS_COLORS[task.status]}
          disabled={!canEdit}
          onChange={(status: DailyTaskStatus) => updateTask(task.id, { status })}
        />

        {canDelete && (
          <IconButton
            size="small"
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete task"
            sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Collapse in={open}>
        <Divider />
        {task.attachments && task.attachments.length > 0 && (
          <Box sx={{ px: 2, pt: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1, color: "text.secondary" }}>
              Assigned Documents:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {task.attachments.map((f, i) => (
                <MuiLink
                  key={i}
                  href={f.url}
                  target="_blank"
                  rel="noopener"
                  variant="body2"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    bgcolor: "surface",
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" },
                    textDecoration: "none"
                  }}
                >
                  <AttachFileIcon sx={{ fontSize: 16 }} />
                  {f.name}
                </MuiLink>
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ px: 2, py: 1.5 }}>
          <TaskReportEditor
            taskId={task.id}
            reports={task.reports ?? (task.report.text || task.report.links.length || task.report.files.length ? [task.report] : [])}
            editable={canEdit}
            currentUser={currentUser}
            onSave={(reports: TaskReport[]) => updateTask(task.id, { reports })}
          />
        </Box>
      </Collapse>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"?`}
        type="error"
        confirmLabel="Delete Task"
        onConfirm={() => {
          deleteTask(task.id);
          setDeleteDialogOpen(false);
        }}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Paper>
  );
}
