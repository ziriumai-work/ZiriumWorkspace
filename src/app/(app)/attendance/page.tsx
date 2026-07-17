"use client";

// Attendance page — comprehensive attendance management with:
// - Clock in/out for employees/interns (within office hours only)
// - Auto late detection with grace period
// - Overtime tracking
// - Admin: view all records, mark attendance, configure office hours
// - Monthly summary with deduction flags

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Toast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToDevelopers } from "@/lib/data/developers";
import {
  clockIn,
  clockOut,
  computeMonthlySummary,
  isWithinOfficeHours,
  markAttendance,
  subscribeToAllAttendance,
  subscribeToMyAttendance,
  subscribeToOfficeSettings,
  updateOfficeSettings,
} from "@/lib/data/attendance";
import { subscribeToTasksForEmployee } from "@/lib/data/tasks";
import {
  ATTENDANCE_STATUSES,
  DEFAULT_OFFICE_SETTINGS,
  type AttendanceRecord,
  type AttendanceStatus,
  type Employee,
  type OfficeSettings,
  type DailyTask,
} from "@/lib/data/types";

// Colour map for attendance status chips.
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "#22c55e",
  late: "#f59e0b",
  half_day: "#3b82f6",
  absent: "#ef4444",
  on_leave: "#a855f7",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatHoursMinutes(hrs: number): string {
  if (isNaN(hrs) || !isFinite(hrs) || hrs <= 0) return "—";
  const totalMinutes = Math.round(hrs * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function calcHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn) return "—";
  const outTime = checkOut ? new Date(checkOut) : new Date();
  const hrs = (outTime.getTime() - new Date(checkIn).getTime()) / 3_600_000;
  return formatHoursMinutes(hrs);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function AttendancePage() {
  const { user, isAdmin, employee, role } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<OfficeSettings>(
    DEFAULT_OFFICE_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ message: string; type: "success" | "warning" | "error" | "info" } | null>(null);

  // Admin: filter by employee uid. "all" = show everyone.
  const [filterUid, setFilterUid] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  // Selected month for summary view.
  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
  );

  // Admin dialog for manually marking attendance.
  const [markOpen, setMarkOpen] = useState(false);
  const [markUid, setMarkUid] = useState("");
  const [markDate, setMarkDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("present");
  const [markCheckIn, setMarkCheckIn] = useState("");
  const [markCheckOut, setMarkCheckOut] = useState("");

  // Admin dialog for office settings.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editSettings, setEditSettings] = useState<OfficeSettings>(
    DEFAULT_OFFICE_SETTINGS,
  );

  // Load office settings.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToOfficeSettings(
      (s) => {
        setSettings(s);
        setEditSettings(s);
      },
      (err) => {
        console.error("Settings error:", err);
        setError("Could not load office settings.");
      }
    );
    return unsub;
  }, [user]);

  // Load employees list.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToDevelopers(
      (devs) => setEmployees(devs ?? []),
      (err) => console.error("Employees error:", err)
    );
    return unsub;
  }, [user]);

  // Subscribe to attendance records.
  useEffect(() => {
    if (!user) return;
    
    // We only want to subscribe once we know if they are an admin.
    // If the role is not yet loaded, wait.
    if (role === null) return;
    
    const handleError = (err: Error) => {
      console.error("Attendance error:", err);
      setError(err.message || "Could not load attendance records.");
      setLoading(false);
    };

    const unsub = isAdmin
      ? subscribeToAllAttendance((r) => {
          setRecords(r);
          setLoading(false);
        }, handleError)
      : subscribeToMyAttendance(user.uid, (r) => {
          setRecords(r);
          setLoading(false);
        }, handleError);
    return unsub;
  }, [user, isAdmin, role]);

  // Subscribe to tasks for non-admins (for stats calculation).
  useEffect(() => {
    if (!employee || isAdmin) return;
    return subscribeToTasksForEmployee(employee.id, (t) => {
      setTasks(t);
    });
  }, [employee, isAdmin]);

  // TEMP DATA FIX: Fix any corrupted records with > 100 hours
  useEffect(() => {
    if (!records.length) return;
    const fixRecords = async () => {
      for (const r of records) {
        if (r.hoursWorked > 100) {
          try {
            await updateDoc(doc(db, "attendance", r.id), {
              hoursWorked: 0,
              checkOut: null
            });
            console.log("Fixed corrupted record:", r.id);
          } catch (e) {
            console.error("Failed to fix record:", e);
          }
        }
      }
    };
    fixRecords();
  }, [records]);

  // Today's record for the current user.
  const today = new Date().toISOString().slice(0, 10);
  const myTodayRecord = useMemo(
    () =>
      user
        ? records.find((r) => r.uid === user.uid && r.date === today) ?? null
        : null,
    [records, user, today],
  );

  // Can clock in/out right now?
  const canClock = isWithinOfficeHours(settings);

  // Filtered view.
  const displayed = useMemo(() => {
    let result = records;
    if (!isAdmin) {
      if (user) result = result.filter((r) => r.uid === user.uid);
    } else {
      if (filterUid !== "all") {
        result = result.filter((r) => r.uid === filterUid);
      }
      if (filterDepartment !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.department === filterDepartment;
        });
      }
      if (filterRole !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.accessLevel === filterRole;
        });
      }
    }
    return result;
  }, [records, filterUid, filterDepartment, filterRole, isAdmin, user, employees]);

  // Monthly summary — filter records by the selected month.
  const monthRecords = useMemo(() => {
    const target = summaryMonth; // "yyyy-mm"
    let result = records.filter(r => r.date.startsWith(target));
    if (!isAdmin) {
      if (user) result = result.filter((r) => r.uid === user.uid);
    } else {
      if (filterUid !== "all") {
        result = result.filter((r) => r.uid === filterUid);
      }
      if (filterDepartment !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.department === filterDepartment;
        });
      }
      if (filterRole !== "all") {
        result = result.filter((r) => {
          const emp = employees.find(e => e.uid === r.uid);
          return emp?.accessLevel === filterRole;
        });
      }
    }
    return result;
  }, [records, summaryMonth, filterUid, filterDepartment, filterRole, isAdmin, user, employees]);

  const summary = useMemo(
    () =>
      computeMonthlySummary(
        monthRecords,
        settings,
        role === "intern",
      ),
    [monthRecords, settings, role],
  );

  // Non-Admin Statistics
  const myStats = useMemo(() => {
    if (isAdmin || !employee) return null;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    const monthPrefix = todayStr.slice(0, 7); // "YYYY-MM"

    // 1. Weekly Hours
    let weeklyHoursWorked = 0;
    records.forEach(r => {
      if (r.date >= weekStartIso && r.date <= todayStr && r.uid === user?.uid) {
        weeklyHoursWorked += r.hoursWorked;
      }
    });

    let weeklyCompensatedHours = 0;
    tasks.forEach(t => {
      if (t.date >= weekStartIso && t.date <= todayStr && t.status === "done" && t.compensatesWeeklyHours) {
        weeklyCompensatedHours += (t.assignedHours || 0);
      }
    });

    const totalWeeklyHours = weeklyHoursWorked + weeklyCompensatedHours;
    const requiredHours = employee.officeHours || 0;
    const remainingHours = Math.max(0, requiredHours - totalWeeklyHours);

    // 2. Flexibility
    let flexibilityUsed = 0; // minutes
    records.forEach(r => {
      if (r.date >= weekStartIso && r.date <= todayStr && r.uid === user?.uid) {
        flexibilityUsed += (r.flexibilityUsed || 0);
      }
    });
    
    const allowedFlex = (employee.flexibilityHours || 0) * 60;
    const flexRemaining = allowedFlex - flexibilityUsed; 

    // 3. Lates & Leaves (Month)
    let monthlyLates = 0;
    let monthlyLeaves = 0;
    records.forEach(r => {
      if (r.date.startsWith(monthPrefix) && r.uid === user?.uid) {
        if (r.isLate) monthlyLates++;
        if (r.status === "on_leave") monthlyLeaves++;
      }
    });

    const latesAllowed = settings.lateThresholdDays;
    const leavesAllowed = employee.accessLevel === "intern" ? settings.internLeavesPerMonth : settings.employeeLeavesPerMonth;

    const isPenaltyActive = monthlyLates > latesAllowed && remainingHours > 0 && flexRemaining < 0;

    return {
      totalWeeklyHours,
      requiredHours,
      remainingHours,
      flexRemaining,
      allowedFlex,
      monthlyLates,
      latesAllowed,
      monthlyLeaves,
      leavesAllowed,
      isPenaltyActive,
    };
  }, [isAdmin, employee, records, tasks, settings, user]);

  // ---- actions ----

  async function handleClockIn() {
    if (!user || !employee) {
      setError("Employee record not found. Cannot clock in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await clockIn(employee, settings);
      setToastMsg({ message: res.message, type: res.status });
    } catch (err) {
      console.error(err);
      setToastMsg({ message: err instanceof Error ? err.message : "Failed to clock in. Make sure you're within office hours.", type: "error" });
    }
    setBusy(false);
  }

  async function handleClockOut() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await clockOut(user.uid, settings);
      setSuccess("Clocked out successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to clock out.");
    }
    setBusy(false);
  }

  async function handleMark() {
    if (!markUid || !markDate) return;
    setBusy(true);
    setError(null);
    try {
      const emp = employees.find((e) => e.uid === markUid);
      const name = emp?.name ?? "Unknown";
      await markAttendance(
        markUid,
        name,
        markDate,
        markStatus,
        settings,
        markCheckIn
          ? new Date(`${markDate}T${markCheckIn}`).toISOString()
          : null,
        markCheckOut
          ? new Date(`${markDate}T${markCheckOut}`).toISOString()
          : null,
      );
      setMarkOpen(false);
      setSuccess("Attendance marked successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to mark attendance.");
    }
    setBusy(false);
  }

  async function handleSaveSettings() {
    setBusy(true);
    setError(null);
    try {
      await updateOfficeSettings(editSettings);
      setSettingsOpen(false);
      setSuccess("Office settings updated!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to save settings.");
    }
    setBusy(false);
  }

  // ---- render ----

  if (loading) {
    return (
      <Box sx={{ px: 4, py: 5 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1200 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin
              ? "Track and manage employee attendance records."
              : "View your attendance history and clock in/out."}
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="outlined"
            onClick={() => {
              setEditSettings(settings);
              setSettingsOpen(true);
            }}
            sx={{ borderRadius: 3, fontSize: 13 }}
          >
            ⚙ Office Settings
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Toast 
        open={toastMsg !== null} 
        message={toastMsg?.message || ""} 
        type={toastMsg?.type} 
        onClose={() => setToastMsg(null)} 
        autoHideDuration={5000}
      />

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Office hours info bar */}
      <Paper
        variant="outlined"
        sx={{
          px: 3,
          py: 1.5,
          mb: 2,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          bgcolor: "surface",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Office Hours
        </Typography>
        <Chip
          size="small"
          label={`${pad(settings.startHour)}:${pad(settings.startMinute)} – ${pad(settings.endHour)}:${pad(settings.endMinute)}`}
          sx={{ fontWeight: 600, fontSize: 12 }}
        />
        <Chip
          size="small"
          label={`${settings.graceMinutes} min grace`}
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
        <Chip
          size="small"
          label={canClock ? "Open" : "Closed"}
          sx={{
            fontWeight: 600,
            fontSize: 11,
            bgcolor: canClock ? "#22c55e22" : "#ef444422",
            color: canClock ? "#22c55e" : "#ef4444",
          }}
        />
      </Paper>

      {/* Non-Admin Statistics Dashboard */}
      {myStats && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 4 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
            My Statistics
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            <StatCard 
              label="Weekly Hours Remaining" 
              value={formatHoursMinutes(myStats.remainingHours)} 
              color={myStats.remainingHours > 0 ? "#f59e0b" : "#22c55e"} 
            />
            <StatCard 
              label="Flexibility Remaining" 
              value={formatHoursMinutes(Math.max(0, myStats.flexRemaining) / 60)} 
              color={myStats.flexRemaining >= 0 ? "#3b82f6" : "#ef4444"} 
            />
            <StatCard 
              label={`Lates (Max: ${myStats.latesAllowed})`} 
              value={myStats.monthlyLates} 
              color={myStats.monthlyLates > myStats.latesAllowed ? "#ef4444" : "#22c55e"} 
            />
            <StatCard 
              label={`Leaves (Max: ${myStats.leavesAllowed})`} 
              value={myStats.monthlyLeaves} 
              color={myStats.monthlyLeaves > myStats.leavesAllowed ? "#ef4444" : "#22c55e"} 
            />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Total Weekly Hours Required: <strong>{myStats.requiredHours}h</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Flexibility Allowed: <strong>{formatHoursMinutes(myStats.allowedFlex / 60)}</strong>
            </Typography>
            {myStats.isPenaltyActive && (
              <Chip
                size="small"
                label="50% Salary Deduction Active (Exhausted Flexibility & Max Lates)"
                sx={{ bgcolor: "#ef444422", color: "#ef4444", fontWeight: 700, fontSize: 12 }}
              />
            )}
            {!myStats.isPenaltyActive && myStats.monthlyLates > myStats.latesAllowed && myStats.remainingHours === 0 && (
              <Chip
                size="small"
                label="Penalty Averted (Compensated Weekly Hours)"
                sx={{ bgcolor: "#22c55e22", color: "#22c55e", fontWeight: 700, fontSize: 12 }}
              />
            )}
          </Box>
        </Paper>
      )}

      {/* Clock in / out card */}
      {!isAdmin && (
        <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Today —{" "}
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Typography>
          {myTodayRecord ? (
            <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                In at {fmtTime(myTodayRecord.checkIn)}
                {myTodayRecord.checkOut
                  ? ` · Out at ${fmtTime(myTodayRecord.checkOut)} · ${calcHours(myTodayRecord.checkIn, myTodayRecord.checkOut)}`
                  : " · Still working"}
              </Typography>
              {myTodayRecord.isLate && (
                <Chip size="small" label="Late" sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontWeight: 600, fontSize: 10, height: 20 }} />
              )}
              {myTodayRecord.isOvertime && (
                <Chip size="small" label={`+${myTodayRecord.overtimeMinutes}min OT`} sx={{ bgcolor: "#3b82f622", color: "#3b82f6", fontWeight: 600, fontSize: 10, height: 20 }} />
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              You have not clocked in yet.
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {!myTodayRecord ? (
            <Button
              variant="contained"
              onClick={handleClockIn}
              disabled={busy || !canClock}
              sx={{ borderRadius: 3, px: 3 }}
            >
              {canClock ? "Clock In" : "Office Closed"}
            </Button>
          ) : !myTodayRecord.checkOut ? (
            <Button
              variant="outlined"
              color="error"
              onClick={handleClockOut}
              disabled={busy}
              sx={{ borderRadius: 3, px: 3 }}
            >
              Clock Out
            </Button>
          ) : (
            <Chip
              label="Day Complete ✓"
              sx={{ bgcolor: "#22c55e22", color: "#22c55e", fontWeight: 600 }}
            />
          )}
        </Box>
      </Paper>
      )}

      {/* Admin controls + filter */}
      {isAdmin && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Filter:
            </Typography>
            <Select
              size="small"
              value={filterUid}
              onChange={(e) => setFilterUid(e.target.value)}
              sx={{ minWidth: 150, borderRadius: 2, fontSize: 14 }}
            >
              <MenuItem value="all">All Employees</MenuItem>
              {employees
                .filter((e) => e.uid)
                .map((e) => (
                  <MenuItem key={e.id} value={e.uid!}>
                    {e.name}
                  </MenuItem>
                ))}
            </Select>
            <Select
              size="small"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              sx={{ minWidth: 120, borderRadius: 2, fontSize: 14 }}
            >
              <MenuItem value="all">All Depts</MenuItem>
              <MenuItem value="web">Web</MenuItem>
              <MenuItem value="ai">AI</MenuItem>
              <MenuItem value="app">App</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
            <Select
              size="small"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              sx={{ minWidth: 120, borderRadius: 2, fontSize: 14 }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="employee">Employee</MenuItem>
              <MenuItem value="intern">Intern</MenuItem>
            </Select>
          </Box>
          <Button
            variant="contained"
            onClick={() => {
              setMarkOpen(true);
              setMarkUid(employees.find((e) => e.uid)?.uid ?? "");
              setMarkDate(today);
              setMarkStatus("on_leave");
              setMarkCheckIn("");
              setMarkCheckOut("");
            }}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Mark Attendance
          </Button>
        </Box>
      )}

      {/* Monthly summary */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Monthly Summary
          </Typography>
          <TextField
            type="month"
            value={summaryMonth}
            onChange={(e) => setSummaryMonth(e.target.value)}
            size="small"
            sx={{
              width: 180,
              "& .MuiOutlinedInput-root": {
                borderRadius: 3,
                transition: "all 0.2s ease-in-out",
                bgcolor: "background.paper",
                "&:hover": {
                  boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.08)",
                },
                "&.Mui-focused": {
                  boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
                },
              },
            }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(5, 1fr)",
            },
            gap: 2,
          }}
        >
          <StatCard label="Present" value={summary.totalPresent} color="#22c55e" />
          <StatCard label="Late" value={summary.totalLate} color="#f59e0b" />
          <StatCard label="Leaves" value={summary.totalLeaves} color="#a855f7" />
          <StatCard label="Absent" value={summary.totalAbsent} color="#ef4444" />
          <StatCard label="Half Day" value={summary.totalHalfDays} color="#3b82f6" />
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Total Hours: <strong>{formatHoursMinutes(summary.totalHoursWorked)}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overtime: <strong>{formatHoursMinutes(summary.totalOvertimeMinutes / 60)}</strong>
          </Typography>
          {summary.lateDaysOverThreshold > 0 && (
            <Chip
              size="small"
              label={`${summary.lateDaysOverThreshold} late day${summary.lateDaysOverThreshold > 1 ? "s" : ""} → 50% deduction each`}
              sx={{ bgcolor: "#ef444422", color: "#ef4444", fontWeight: 600, fontSize: 11 }}
            />
          )}
          {summary.excessLeaves > 0 && (
            <Chip
              size="small"
              label={`${summary.excessLeaves} excess leave${summary.excessLeaves > 1 ? "s" : ""} → 1 day deduction each`}
              sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontWeight: 600, fontSize: 11 }}
            />
          )}
          {summary.deductionDays > 0 && (
            <Chip
              size="small"
              label={`Total deduction: ${summary.deductionDays} day${summary.deductionDays > 1 ? "s" : ""} salary`}
              sx={{ bgcolor: "#ef444422", color: "#ef4444", fontWeight: 700, fontSize: 12 }}
            />
          )}
          {summary.deductionDays === 0 && summary.totalPresent > 0 && (
            <Chip
              size="small"
              label="No deductions ✓"
              sx={{ bgcolor: "#22c55e22", color: "#22c55e", fontWeight: 600, fontSize: 11 }}
            />
          )}
        </Box>
      </Paper>

      {/* Records table */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 4, overflow: "hidden" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "surface" }}>
              {isAdmin && (
                <>
                  <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Member</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Department</TableCell>
                </>
              )}
              <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Clock In</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Clock Out</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Hours</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Flags</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 6}
                  sx={{
                    textAlign: "center",
                    py: 4,
                    color: "text.secondary",
                  }}
                >
                  No attendance records found.
                </TableCell>
              </TableRow>
            ) : (
              displayed.map((r) => (
                <TableRow key={r.id} hover>
                  {isAdmin && (
                    <>
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              fontSize: 11,
                              bgcolor: "accentSoft",
                              color: "primary.main",
                            }}
                          >
                            {r.employeeName?.charAt(0).toUpperCase() ?? "?"}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {r.employeeName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: "capitalize", color: "text.secondary" }}>
                          {employees.find(e => e.uid === r.uid)?.accessLevel ?? "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: "uppercase", color: "text.secondary" }}>
                          {(() => {
                            const emp = employees.find(e => e.uid === r.uid);
                            if (!emp) return "-";
                            return emp.department === "custom" && emp.customDepartment ? emp.customDepartment : emp.department;
                          })()}
                        </Typography>
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(r.date + "T00:00:00").toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        ATTENDANCE_STATUSES.find((s) => s.value === r.status)
                          ?.label ?? r.status
                      }
                      size="small"
                      sx={{
                        bgcolor: `${STATUS_COLORS[r.status]}22`,
                        color: STATUS_COLORS[r.status],
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {fmtTime(r.checkIn)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {fmtTime(r.checkOut)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {calcHours(r.checkIn, r.checkOut)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {r.isLate && (
                        <Chip
                          size="small"
                          label="Late"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: "#f59e0b22",
                            color: "#f59e0b",
                            fontWeight: 600,
                          }}
                        />
                      )}
                      {r.isOvertime && (
                        <Chip
                          size="small"
                          label={`+${r.overtimeMinutes < 60 ? `${r.overtimeMinutes}m` : `${Math.floor(r.overtimeMinutes / 60)}h ${r.overtimeMinutes % 60}m`} OT`}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: "#3b82f622",
                            color: "#3b82f6",
                            fontWeight: 600,
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Admin: Mark attendance dialog */}
      <Dialog
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Mark Attendance</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <Select
            value={markUid}
            onChange={(e) => setMarkUid(e.target.value)}
            fullWidth
            size="small"
            displayEmpty
            sx={{ borderRadius: 2, fontSize: 14 }}
          >
            <MenuItem value="" disabled>
              Select employee
            </MenuItem>
            {employees
              .filter((e) => e.uid)
              .map((e) => (
                <MenuItem key={e.uid!} value={e.uid!}>
                  {e.name}
                </MenuItem>
              ))}
          </Select>
          <TextField
            label="Date"
            type="date"
            value={markDate}
            onChange={(e) => {
              const newDate = e.target.value;
              setMarkDate(newDate);
              if (newDate > new Date().toISOString().slice(0, 10) && markStatus !== "on_leave") {
                setMarkStatus("on_leave");
              }
            }}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.08)",
                },
                "&.Mui-focused": {
                  boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
                },
              },
            }}
          />
          <Select
            value={markStatus}
            onChange={(e) =>
              setMarkStatus(e.target.value as AttendanceStatus)
            }
            fullWidth
            size="small"
            sx={{
              borderRadius: 2,
              fontSize: 14,
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.08)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
              },
            }}
          >
            <MenuItem value="on_leave">On Leave</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMarkOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMark}
            disabled={busy || !markUid}
            sx={{ borderRadius: 3 }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin: Office settings dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Office Settings
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            pt: "8px !important",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Office Hours
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Start time"
              type="time"
              value={`${pad(editSettings.startHour)}:${pad(editSettings.startMinute)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setEditSettings((s) => ({
                  ...s,
                  startHour: h,
                  startMinute: m,
                }));
              }}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End time"
              type="time"
              value={`${pad(editSettings.endHour)}:${pad(editSettings.endMinute)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setEditSettings((s) => ({
                  ...s,
                  endHour: h,
                  endMinute: m,
                }));
              }}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <Divider />

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Policy
          </Typography>
          <TextField
            label="Grace period (minutes)"
            type="number"
            value={editSettings.graceMinutes}
            onChange={(e) =>
              setEditSettings((s) => ({
                ...s,
                graceMinutes: Number(e.target.value),
              }))
            }
            fullWidth
            helperText="Check-in within this time after start is considered on time."
          />
          <TextField
            label="Late threshold (days/month)"
            type="number"
            value={editSettings.lateThresholdDays}
            onChange={(e) =>
              setEditSettings((s) => ({
                ...s,
                lateThresholdDays: Number(e.target.value),
              }))
            }
            fullWidth
            helperText="After this many late days, salary deduction starts."
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Employee leaves/month"
              type="number"
              value={editSettings.employeeLeavesPerMonth}
              onChange={(e) =>
                setEditSettings((s) => ({
                  ...s,
                  employeeLeavesPerMonth: Number(e.target.value),
                }))
              }
              fullWidth
            />
            <TextField
              label="Intern leaves/month"
              type="number"
              value={editSettings.internLeavesPerMonth}
              onChange={(e) =>
                setEditSettings((s) => ({
                  ...s,
                  internLeavesPerMonth: Number(e.target.value),
                }))
              }
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={busy}
            sx={{ borderRadius: 3 }}
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Small stat card used in the monthly summary grid.
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        textAlign: "center",
        borderColor: `${color}44`,
        bgcolor: `${color}08`,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
          borderColor: color,
          bgcolor: `${color}15`,
          transform: "translateY(-4px)",
          boxShadow: `0 12px 24px -8px ${color}60`,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "2px",
          bgcolor: color,
          opacity: 0.5,
        }
      }}
    >
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color, lineHeight: 1 }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 0.5, display: "block", fontWeight: 500 }}
      >
        {label}
      </Typography>
    </Paper>
  );
}
