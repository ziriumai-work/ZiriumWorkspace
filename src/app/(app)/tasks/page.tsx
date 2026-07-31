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
import { AssignTaskForm } from "@/components/tasks/AssignTaskForm";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TASK_STATUS_COLORS } from "@/components/projectMeta";
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
    const review = 0;
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
                {employees
                  .filter((e) => e.accessLevel !== "admin" && e.accessLevel !== "owner")
                  .map(e => (
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
