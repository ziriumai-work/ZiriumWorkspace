"use client";

// Tasks. Admins assign dated tasks to employees and see everything; employees
// see only their own tasks and submit a report (text + links + files) per task.

import { useEffect, useMemo, useState, useRef } from "react";
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
import FilterListIcon from "@mui/icons-material/FilterList";
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
import { doc, collection, updateDoc } from "firebase/firestore";
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
  }, [isAdmin, employee]);

  // TEMP DATA FIX: Fix any corrupted tasks with overtimeCost > 0 but compensatesWeeklyHours === true
  useEffect(() => {
    if (!tasks.length || !isAdmin) return;
    const fixTasks = async () => {
      for (const t of tasks) {
        if (t.isOvertime && t.compensatesWeeklyHours && t.overtimeCost && t.overtimeCost > 0) {
          try {
            await updateDoc(doc(db, "tasks", t.id), {
              overtimeCost: 0
            });
            console.log("Fixed corrupted task:", t.id);
          } catch (e) {
            console.error("Failed to fix task:", e);
          }
        }
      }
    };
    fixTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isAdmin]);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<DailyTaskStatus | "all">("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  // Fetch developers for profile photos & admin picker, plus projects for admins.
  useEffect(() => {
    const u1 = subscribeToDevelopers(setEmployees);
    const u2 = isAdmin ? subscribeToProjects(setProjects) : () => {};
    return () => {
      u1();
      u2();
    };
  }, [isAdmin]);

  // Quick stats summary
  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === "todo").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const review = tasks.filter(t => t.status === "review").length;
    const done = tasks.filter(t => t.status === "done").length;
    const overtime = tasks.filter(t => t.isOvertime).length;
    return { total, todo, inProgress, review, done, overtime };
  }, [tasks]);

  // Filter and Group tasks by date (already sorted newest-first).
  const groups = useMemo(() => {
    let filtered = tasks;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    
    if (filterDate) {
      filtered = filtered.filter(t => t.date === filterDate);
    }
    
    if (filterStatus !== "all") {
      filtered = filtered.filter(t => t.status === filterStatus);
    }
    
    if (isAdmin && filterAssignee !== "all") {
      filtered = filtered.filter(t => t.assigneeId === filterAssignee);
    }

    const out: { date: string; items: DailyTask[] }[] = [];
    for (const t of filtered) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [tasks, searchQuery, filterDate, filterStatus, filterAssignee, isAdmin]);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: { xs: 2, sm: 4, md: 6 }, py: 5 }}>
      <Box component="header" sx={{ mb: 2 }}>
        <Typography variant="h1">{isAdmin ? "Tasks" : "My Tasks"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {isAdmin
            ? "Assign daily tasks to employees and track their reports."
            : "Your assigned tasks. Update status and submit a report for each."}
        </Typography>
      </Box>

      {/* Minimalist Linear Statusline with Hover Lift & Glow */}
      <Box
        sx={{
          mb: 3.5,
          p: 1.25,
          px: 2.25,
          borderRadius: 3,
          bgcolor: "surface",
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: { xs: 1.5, sm: 2.5 },
          fontSize: 12,
          fontFamily: "var(--font-geist-mono), monospace",
          transition: "all 0.25s ease-in-out",
          cursor: "default",
          "&:hover": {
            borderColor: "primary.main",
            boxShadow: "0 6px 20px -6px rgba(13, 147, 199, 0.18)",
            transform: "translateY(-2px)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main" }} />
          <Typography variant="caption" sx={{ fontFamily: "inherit", fontWeight: 600, color: "text.primary" }}>
            {stats.total} {stats.total === 1 ? "Task" : "Tasks"}
          </Typography>
        </Box>
        <Divider orientation="vertical" flexItem sx={{ height: 12, my: "auto" }} />
        <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
          <Box component="span" sx={{ color: TASK_STATUS_COLORS.todo, fontWeight: 600 }}>{stats.todo}</Box> to do
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
          <Box component="span" sx={{ color: TASK_STATUS_COLORS.in_progress, fontWeight: 600 }}>{stats.inProgress}</Box> in progress
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: "inherit", color: "text.secondary" }}>
          <Box component="span" sx={{ color: TASK_STATUS_COLORS.done, fontWeight: 600 }}>{stats.done}</Box> complete
        </Typography>
        {stats.overtime > 0 && (
          <>
            <Divider orientation="vertical" flexItem sx={{ height: 12, my: "auto" }} />
            <Typography variant="caption" sx={{ fontFamily: "inherit", color: "#ef4444", fontWeight: 600 }}>
              ⚡ {stats.overtime} overtime
            </Typography>
          </>
        )}
      </Box>

      {isAdmin && (
        <AssignTaskForm
          employees={employees}
          projects={projects}
          onAssign={(input) => createTask(input, user?.uid ?? "")}
        />
      )}

      {/* Filter Toggle */}
      <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 3, mb: showFilters ? 2 : 3 }}>
        <IconButton 
          onClick={() => setShowFilters(!showFilters)}
          sx={{ 
            bgcolor: showFilters ? "primary.main" : "transparent",
            color: showFilters ? "primary.contrastText" : "text.secondary",
            border: "1px solid",
            borderColor: showFilters ? "primary.main" : "divider",
            borderRadius: 2,
            "&:hover": {
              bgcolor: showFilters ? "primary.dark" : "action.hover",
            }
          }}
        >
          <FilterListIcon />
        </IconButton>
      </Box>

      {/* Filters Form */}
      <Collapse in={showFilters}>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
          />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            <TextField
              size="small"
              type="date"
              label="Filter by Date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 160 }}
            />
            <Select
              size="small"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as DailyTaskStatus | "all")}
              displayEmpty
              sx={{ width: 140 }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              {DAILY_TASK_STATUSES.map(s => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
            {isAdmin && (
              <Select
                size="small"
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                displayEmpty
                sx={{ width: 160 }}
              >
                <MenuItem value="all">All Members</MenuItem>
                {employees.map(e => (
                  <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>
                ))}
              </Select>
            )}
            {(searchQuery || filterDate || filterStatus !== "all" || filterAssignee !== "all") && (
              <Button size="small" onClick={() => {
                setSearchQuery("");
                setFilterDate("");
                setFilterStatus("all");
                setFilterAssignee("all");
              }}>Clear Filters</Button>
            )}
          </Box>
        </Paper>
      </Collapse>

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
                    mb: 1.25,
                    display: "block",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: 11,
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {g.date}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {g.items.map((t, index) => (
                    <ScrollReveal key={t.id}>
                      <TaskCard
                        task={t}
                        showAssignee={isAdmin}
                        canEdit={isAdmin || employee?.id === t.assigneeId}
                        canDelete={isAdmin}
                        currentUser={{
                          uid: user?.uid ?? "",
                          name: employee?.name ?? user?.displayName ?? "User",
                          isAdmin,
                        }}
                        employees={employees}
                        index={index}
                      />
                    </ScrollReveal>
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

function TaskCard({
  task,
  showAssignee,
  canEdit,
  canDelete,
  currentUser,
  employees = [],
  index = 0,
}: {
  task: DailyTask;
  showAssignee: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUser: { uid: string; name: string; isAdmin: boolean };
  employees?: Employee[];
  index?: number;
}) {
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const reportsCount = task.reports ? task.reports.length : (task.report?.text || task.report?.links?.length || task.report?.files?.length ? 1 : 0);
  const hasReport = reportsCount > 0;

  const isLive = task.status === "in_progress";
  const emp = employees.find((e) => e.id === task.assigneeId);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        borderColor: open ? "primary.main" : "divider",
        bgcolor: open ? "surface" : "background.paper",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.12)",
          transform: "translateY(-4px) scale(1.015)",
          "& .docket-scanline": {
            transform: "translateX(100%)",
          },
        },
      }}
    >
      {/* Top subtle scanline sweep effect on hover */}
      <Box
        className="docket-scanline"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "2px",
          background: "linear-gradient(90deg, transparent, var(--mui-palette-primary-main), transparent)",
          transform: "translateX(-100%)",
          transition: "transform 0.6s ease-in-out",
          zIndex: 2,
        }}
      />

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75, px: 2.5, py: 2 }}>
        {/* Employee / Intern Profile Avatar */}
        <Avatar
          src={emp?.photoURL || undefined}
          sx={{
            width: 38,
            height: 38,
            fontSize: 14,
            fontWeight: 700,
            bgcolor: "accentSoft",
            color: "primary.main",
            border: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          {task.assigneeName?.charAt(0).toUpperCase() ?? "?"}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {/* Assignee Name Label */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: "primary.main",
                textTransform: "uppercase",
                fontSize: 10.5,
                letterSpacing: "0.04em",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {task.assigneeName || "Unassigned"}
            </Typography>

            {/* Live Indicator Dot */}
            {isLive && (
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: TASK_STATUS_COLORS[task.status],
                  animation: "live-pulse 2s infinite",
                  flexShrink: 0,
                }}
              />
            )}
          </Box>

          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 14, color: "text.primary", mt: 0.25 }}>
            {task.title}
          </Typography>

          {task.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13, lineHeight: 1.4 }}>
              {task.description}
            </Typography>
          )}

          {/* Micro Tags Bar */}
          <Box
            sx={{
              mt: 1.25,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            {task.projectTitle && (
              <Chip
                label={task.projectTitle}
                size="small"
                sx={{ bgcolor: "surface", fontSize: 11, height: 22, border: "1px solid", borderColor: "divider" }}
              />
            )}
            {!!task.assignedHours && task.assignedHours > 0 && (
              <Chip
                label={`${task.assignedHours}h assigned`}
                size="small"
                sx={{ bgcolor: "surface", fontSize: 11, height: 22, border: "1px solid", borderColor: "divider" }}
              />
            )}
            {task.isOvertime && (
              <Chip
                label={task.compensatesWeeklyHours ? "Compensatory Task" : `Overtime (${formatCurrency(task.overtimeCost || 0)})`}
                size="small"
                sx={{ bgcolor: "#ef444415", color: "#ef4444", fontWeight: 600, fontSize: 11, height: 22, border: "1px solid #ef444433" }}
              />
            )}
            {task.attachments && task.attachments.length > 0 && (
              <Chip
                label={`${task.attachments.length} doc(s)`}
                size="small"
                sx={{ bgcolor: "surface", fontSize: 11, height: 22, border: "1px solid", borderColor: "divider", cursor: "pointer" }}
                onClick={() => setOpen(true)}
              />
            )}

            <MuiLink
              component="button"
              variant="caption"
              underline="none"
              onClick={() => setOpen((v) => !v)}
              sx={{
                position: "relative",
                fontWeight: 600,
                color: open ? "primary.main" : "text.secondary",
                fontSize: 12,
                transition: "color 0.2s ease",
                border: "none",
                background: "none",
                cursor: "pointer",
                p: 0,
                ml: 0.5,
                "&:hover": {
                  color: "primary.main",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -2,
                  left: 0,
                  width: "100%",
                  height: "2px",
                  borderRadius: "2px",
                  bgcolor: "primary.main",
                  transform: open ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "right",
                  transition: "transform 0.3s ease",
                },
                "&:hover::after": {
                  transform: "scaleX(1)",
                  transformOrigin: "left",
                },
              }}
            >
              {open ? "Hide updates" : hasReport ? `View ${reportsCount} update${reportsCount > 1 ? "s" : ""}` : "Add update"}
            </MuiLink>
          </Box>
        </Box>

        {/* Status Dropdown / Complete Chip */}
        {!currentUser.isAdmin && task.status === "done" ? (
          <Chip
            label="Complete"
            sx={{
              bgcolor: TASK_STATUS_COLORS.done,
              color: "white",
              fontWeight: 600,
              fontSize: 12,
              height: 28,
            }}
          />
        ) : (
          <PillSelect
            value={task.status}
            options={currentUser.isAdmin ? DAILY_TASK_STATUSES : DAILY_TASK_STATUSES.filter((s) => s.value !== "done")}
            color={TASK_STATUS_COLORS[task.status]}
            onChange={(status: DailyTaskStatus) => updateTask(task.id, { status })}
          />
        )}

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
          <Box sx={{ px: 2.5, pt: 1.5 }}>
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
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    fontSize: 12,
                    "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                    textDecoration: "none",
                  }}
                >
                  <AttachFileIcon sx={{ fontSize: 15 }} />
                  {f.name}
                </MuiLink>
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ px: 2.5, py: 2 }}>
          <TaskReportEditor
            taskId={task.id}
            reports={task.reports ?? (task.report?.text || task.report?.links?.length || task.report?.files?.length ? [task.report] : [])}
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

function ScrollReveal({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [offsetY, setOffsetY] = useState(30);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          // Reset animation state when scrolled out of view
          setIsVisible(false);
          // Determine where it went out (top or bottom) to prepare next entry direction
          if (entry.boundingClientRect.top < 0) {
            setOffsetY(-30); // Went out top, so come from top next time
          } else {
            setOffsetY(30);  // Went out bottom, so come from bottom next time
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : `translateY(${offsetY}px)`,
        transition: "opacity 0.4s ease-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </div>
  );
}
