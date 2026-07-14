"use client";

// Tasks. Admins assign dated tasks to employees and see everything; employees
// see only their own tasks and submit a report (text + links + files) per task.

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  subscribeToAllTasks,
  subscribeToTasksForEmployee,
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/data/tasks";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { subscribeToProjects } from "@/lib/data/projects";
import { TaskReportEditor } from "@/components/tasks/TaskReportEditor";
import { TASK_STATUS_COLORS } from "@/components/projectMeta";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  DAILY_TASK_STATUSES,
  type DailyTask,
  type DailyTaskStatus,
  type Employee,
  type Project,
  type TaskReport,
} from "@/lib/data/types";

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
  onAssign: (input: {
    title: string;
    description: string;
    assigneeId: string;
    assigneeName: string;
    projectId: string | null;
    projectTitle: string | null;
    date: string;
  }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    if (!title.trim() || !assigneeId) {
      setError("A title and an assignee are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const emp = employees.find((e) => e.id === assigneeId);
      const proj = projects.find((p) => p.id === projectId);
      await onAssign({
        title,
        description,
        assigneeId,
        assigneeName: emp?.name ?? "",
        projectId: proj?.id ?? null,
        projectTitle: proj?.title ?? null,
        date,
      });
      setTitle("");
      setDescription("");
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
            <MenuItem value="">No project</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.title}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Button
            onClick={assign}
            disabled={saving}
            variant="contained"
            fullWidth
            sx={{ height: "100%" }}
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
}: {
  task: DailyTask;
  showAssignee: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasReport =
    task.report.text || task.report.links.length || task.report.files.length;

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
            <MuiLink
              component="button"
              variant="caption"
              color="text.secondary"
              underline="hover"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide report" : hasReport ? "View report" : "Add report"}
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
            onClick={() => {
              if (confirm(`Delete task "${task.title}"?`)) deleteTask(task.id);
            }}
            title="Delete task"
            sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <TaskReportEditor
            taskId={task.id}
            report={task.report}
            editable={canEdit}
            onSave={(report: TaskReport) => updateTask(task.id, { report })}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}
