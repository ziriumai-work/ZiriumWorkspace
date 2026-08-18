"use client";

import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArchiveIcon from "@mui/icons-material/Archive";
import SnoozeIcon from "@mui/icons-material/Snooze";
import EditIcon from "@mui/icons-material/Edit";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToPersonalTasks, createPersonalTask, updatePersonalTask } from "@/lib/data/personal-tasks";
import { Toast } from "@/components/ui/Toast";
import type { PersonalTask, PersonalTaskPriority, PersonalTaskCategory } from "@/lib/data/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PersonalTasksDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [filter, setFilter] = useState<"pending" | "done" | "archived">("pending");
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<PersonalTaskPriority>("Medium");
  const [category, setCategory] = useState<PersonalTaskCategory>("Work");
  const [isRoutine, setIsRoutine] = useState(false);
  const [routineDays, setRoutineDays] = useState<number[]>([]);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetTime, setTargetTime] = useState("17:00");
  const [notifyMinutes, setNotifyMinutes] = useState(30);

  const [toastMsg, setToastMsg] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user || !open) return;
    const unsub = subscribeToPersonalTasks(user.uid, (data) => {
      setTasks(data.sort((a, b) => b.targetTime.localeCompare(a.targetTime)));
    });
    return unsub;
  }, [user, open]);

  const handleCreate = async () => {
    if (!user || !title) return;
    try {
      if (editingTaskId) {
        await updatePersonalTask(editingTaskId, {
          title,
          description,
          priority,
          category,
          isRoutine,
          routineDays: isRoutine ? routineDays : [],
          targetDate: !isRoutine ? targetDate : "",
          targetTime,
          notifyMinutesBefore: notifyMinutes,
          emailSent: false, // Reset email notification state so it fires again for the new time
        });
        setToastMsg({ message: "Task updated successfully!", type: "success" });
      } else {
        await createPersonalTask({
          uid: user.uid,
          title,
          description,
          priority,
          category,
          status: "pending",
          isRoutine,
          routineDays: isRoutine ? routineDays : [],
          targetDate: !isRoutine ? targetDate : "",
          targetTime,
          notifyMinutesBefore: notifyMinutes,
        });
        setToastMsg({ message: "Task created successfully!", type: "success" });
      }
      setIsCreating(false);
      setEditingTaskId(null);
      setTitle("");
      setDescription("");
    } catch (err: any) {
      console.error(err);
      setToastMsg({ message: err.message || "Failed to save task", type: "error" });
    }
  };

  const handleEditClick = (task: PersonalTask) => {
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);
    setCategory(task.category);
    setIsRoutine(task.isRoutine);
    setRoutineDays(task.routineDays);
    setTargetDate(task.targetDate || new Date().toISOString().slice(0, 10));
    setTargetTime(task.targetTime);
    setNotifyMinutes(task.notifyMinutesBefore);
    setEditingTaskId(task.id);
    setIsCreating(true);
  };

  const handleToggleDay = (dayIndex: number) => {
    if (routineDays.includes(dayIndex)) {
      setRoutineDays(routineDays.filter((d) => d !== dayIndex));
    } else {
      setRoutineDays([...routineDays, dayIndex]);
    }
  };

  const getPriorityColor = (p: string) => {
    if (p === "High") return "error";
    if (p === "Medium") return "warning";
    return "info";
  };

  const filteredTasks = tasks.filter(t => t.status === filter);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ "& .MuiDrawer-paper": { width: { xs: "100%", sm: 400 } } }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Personal Tasks</Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2, display: "flex", gap: 1, borderBottom: 1, borderColor: "divider" }}>
        {["pending", "done", "archived"].map(f => (
          <Chip 
            key={f} 
            label={f.charAt(0).toUpperCase() + f.slice(1)} 
            color={filter === f ? "primary" : "default"} 
            onClick={() => setFilter(f as any)} 
            variant={filter === f ? "filled" : "outlined"}
            sx={{ flex: 1, cursor: "pointer", fontWeight: filter === f ? 600 : 400 }}
          />
        ))}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 2, "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 3 } }}>
        {isCreating ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2, bgcolor: "background.default", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{editingTaskId ? "Edit Task" : "New Task"}</Typography>
            <TextField label="Task Title" size="small" fullWidth value={title} onChange={e => setTitle(e.target.value)} />
            <TextField label="Description (Optional)" size="small" fullWidth multiline rows={2} value={description} onChange={e => setDescription(e.target.value)} />
            
            <Stack direction="row" spacing={2}>
              <Select size="small" fullWidth value={priority} onChange={e => setPriority(e.target.value as any)}>
                <MenuItem value="High">High Priority</MenuItem>
                <MenuItem value="Medium">Medium Priority</MenuItem>
                <MenuItem value="Low">Low Priority</MenuItem>
              </Select>
              <Select size="small" fullWidth value={category} onChange={e => setCategory(e.target.value as any)}>
                <MenuItem value="Work">Work</MenuItem>
                <MenuItem value="Meeting">Meeting</MenuItem>
                <MenuItem value="Personal">Personal</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </Stack>

            <FormControlLabel control={<Switch checked={isRoutine} onChange={e => setIsRoutine(e.target.checked)} />} label="Routine Task" />
            
            {isRoutine ? (
              <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Repeat on days</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: "wrap" }}>
                  {DAYS.map((day, idx) => (
                    <Chip 
                      key={day} label={day} 
                      size="small" 
                      color={routineDays.includes(idx) ? "primary" : "default"}
                      onClick={() => handleToggleDay(idx)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                  <Chip label="All" size="small" onClick={() => setRoutineDays([0,1,2,3,4,5,6])} sx={{ cursor: 'pointer' }} />
                </Box>
              </Box>
            ) : (
              <TextField type="date" label="Target Date" size="small" fullWidth value={targetDate} onChange={e => setTargetDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            )}

            <Stack direction="row" spacing={2}>
              <TextField type="time" label="Target Time" size="small" fullWidth value={targetTime} onChange={e => setTargetTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField type="number" label="Notify (mins before)" size="small" fullWidth value={notifyMinutes} onChange={e => setNotifyMinutes(Number(e.target.value))} />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 1 }}>
              <Button onClick={() => { setIsCreating(false); setEditingTaskId(null); }} color="inherit">Cancel</Button>
              <Button onClick={handleCreate} variant="contained" disabled={!title}>Save Task</Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Button startIcon={<AddIcon />} variant="outlined" fullWidth onClick={() => setIsCreating(true)} sx={{ borderStyle: "dashed", borderRadius: 2 }}>
              Create New Task
            </Button>

            {filteredTasks.map(t => (
              <Box 
                key={t.id} 
                sx={{ 
                  p: 2, 
                  bgcolor: "background.paper", 
                  borderRadius: 2, 
                  border: "1px solid", 
                  transition: "all 0.2s", 
                  borderColor: (theme) => `${theme.palette[t.priority === 'High' ? 'error' : t.priority === 'Medium' ? 'warning' : 'info'].main}80`,
                  "&:hover": { 
                    borderColor: t.priority === 'High' ? 'error.main' : t.priority === 'Medium' ? 'warning.main' : 'info.main',
                    boxShadow: (theme) => `0 4px 16px ${theme.palette[t.priority === 'High' ? 'error' : t.priority === 'Medium' ? 'warning' : 'info'].main}40` 
                  } 
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography sx={{ fontWeight: 500, fontSize: "0.95rem" }}>{t.title}</Typography>
                  <Chip size="small" label={t.priority} color={getPriorityColor(t.priority) as any} sx={{ height: 20, fontSize: "0.7rem" }} />
                </Box>
                {t.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t.description}</Typography>}
                
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 2 }}>
                  <Chip size="small" label={t.category} variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                  {t.isRoutine ? (
                    <Typography variant="caption" color="primary">Routine: {t.targetTime}</Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">{t.targetDate} at {t.targetTime}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                    <NotificationsActiveIcon sx={{ fontSize: 14 }} /> {t.notifyMinutesBefore}m before
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                  {t.status === "pending" && (
                    <>
                      <Tooltip title="Edit Task">
                        <IconButton size="small" onClick={() => handleEditClick(t)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Snooze 30m"><IconButton size="small" onClick={() => {
                         const [h, m] = t.targetTime.split(":").map(Number);
                         const totalMins = h * 60 + m + 30;
                         const newH = Math.floor(totalMins / 60) % 24;
                         const newM = totalMins % 60;
                         const newTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
                         updatePersonalTask(t.id, { targetTime: newTime, emailSent: false });
                      }}><SnoozeIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Mark Done"><IconButton color="success" size="small" onClick={() => updatePersonalTask(t.id, { status: "done" })}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Archive"><IconButton size="small" onClick={() => updatePersonalTask(t.id, { status: "archived" })}><ArchiveIcon fontSize="small" /></IconButton></Tooltip>
                    </>
                  )}
                  {t.status === "done" && (
                    <Tooltip title="Archive"><IconButton size="small" onClick={() => updatePersonalTask(t.id, { status: "archived" })}><ArchiveIcon fontSize="small" /></IconButton></Tooltip>
                  )}
                </Box>
              </Box>
            ))}
            {filteredTasks.length === 0 && !isCreating && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>No {filter} tasks found.</Typography>
            )}
          </Box>
        )}
      </Box>

      {toastMsg && (
        <Toast
          open={!!toastMsg}
          message={toastMsg.message}
          type={toastMsg.type}
          onClose={() => setToastMsg(null)}
        />
      )}
    </Drawer>
  );
}
