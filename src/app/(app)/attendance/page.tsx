"use client";

// Attendance page — comprehensive attendance management with:
// - Clock in/out for employees/interns (within office hours only)
// - Auto late detection with grace period
// - Overtime tracking
// - Admin: view all records, mark attendance, configure office hours
// - Monthly summary with deduction flags

import { useState, useMemo, useEffect, useRef } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";

import {
  clockIn,
  clockOut,
  markAttendance,
  updateOfficeSettings,
  isWithinOfficeHours,
} from "@/lib/data/attendance";
import {
  DEFAULT_OFFICE_SETTINGS,
  type AttendanceStatus,
  type OfficeSettings,
} from "@/lib/data/types";
import { pad } from "@/components/attendance/attendance-utils";

import { AdminEmployeeCard } from "@/components/attendance/AdminEmployeeCard";
import { MarkAttendanceModal } from "@/components/attendance/MarkAttendanceModal";
import { AttendanceSettingsModal } from "@/components/attendance/AttendanceSettingsModal";
import { ExportAttendanceModal } from "@/components/attendance/ExportAttendanceModal";
import { OfficeHoursBanner } from "@/components/attendance/OfficeHoursBanner";
import { EmployeeStatsDashboard } from "@/components/attendance/EmployeeStatsDashboard";
import { ClockInOutCard } from "@/components/attendance/ClockInOutCard";
import { AdminFilters } from "@/components/attendance/AdminFilters";
import { MonthlySummaryCard } from "@/components/attendance/MonthlySummaryCard";
import { EmployeeAttendanceTable } from "@/components/attendance/EmployeeAttendanceTable";

import { useAttendanceData } from "@/hooks/useAttendanceData";
import { useAttendanceStats } from "@/hooks/useAttendanceStats";

export default function AttendancePage() {
  const router = useRouter();

  // Data hook
  const { records, tasks, employees, settings, loading, error, setError, user, isAdmin, employee } = useAttendanceData();

  // Component state
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ message: string; type: "success" | "warning" | "error" | "info" } | null>(null);

  // Filters
  const [filterUid, setFilterUid] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
  );

  // Admin modala
  const todayStr = now.toISOString().slice(0, 10);
  const [markOpen, setMarkOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [markUid, setMarkUid] = useState("");
  const [markDate, setMarkDate] = useState(todayStr);
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("present");
  const [markCheckIn, setMarkCheckIn] = useState("");
  const [markCheckOut, setMarkCheckOut] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editSettings, setEditSettings] = useState<OfficeSettings>(DEFAULT_OFFICE_SETTINGS);

  // Stats hook
  const { displayed, monthRecords, monthTasks, summary, myStats, targetEmployee, isTargetIntern } = useAttendanceStats({
    records,
    tasks,
    employees,
    settings,
    user,
    isAdmin,
    employee,
    filterUid,
    filterDepartment,
    filterRole,
    summaryMonth,
  });

  // Derived
  const myTodayRecord = useMemo(
    () =>
      user
        ? records.find((r) => r.uid === user.uid && r.date === todayStr) ?? null
        : null,
    [records, user, todayStr],
  );

  // Compute canClock only on the client to avoid SSR timezone mismatch
  // (Vercel SSR uses UTC; the user's browser uses local time).
  const [canClock, setCanClock] = useState(true);
  useEffect(() => {
    const check = () => setCanClock(isWithinOfficeHours(settings));
    check();
    const interval = setInterval(check, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [settings]);

  // Actions
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
      const res = await clockOut(user.uid, settings, employee || undefined);
      setToastMsg({ message: res.message, type: res.status });
    } catch (err) {
      console.error(err);
      setToastMsg({ message: err instanceof Error ? err.message : "Failed to clock out.", type: "error" });
    }
    setBusy(false);
  }

  async function handleMark() {
    if (!markUid || !markDate) return;
    setBusy(true);
    setError(null);
    try {
      if (markUid.startsWith("bulk_")) {
        let targets = employees.filter((e) => e.uid);
        if (markUid === "bulk_interns") {
          targets = targets.filter((e) => e.accessLevel === "intern" || e.employmentType === "intern");
        } else if (markUid === "bulk_employees") {
          targets = targets.filter((e) => e.accessLevel !== "intern" && e.employmentType !== "intern");
        }

        if (targets.length === 0) {
          setError("No matching staff found for this bulk operation.");
          setBusy(false);
          return;
        }

        if (markStatus === "clock_out" && markDate !== new Date().toISOString().slice(0, 10)) {
          setError("You can only clock out staff for today's date.");
          setBusy(false);
          return;
        }

        let successCount = 0;
        let failCount = 0;

        await Promise.all(
          targets.map(async (emp) => {
            try {
              if (markStatus === "clock_out") {
                const res = await clockOut(emp.uid!, settings, emp);
                if (res.status === "success") successCount++;
                else failCount++;
              } else {
                await markAttendance(
                  emp.uid!,
                  emp.name,
                  markDate,
                  markStatus,
                  settings,
                  null, // checkIn
                  null // checkOut
                );
                successCount++;
              }
            } catch (err) {
              failCount++;
            }
          })
        );

        setMarkOpen(false);
        setSuccess(`Successfully marked ${successCount} staff. ${failCount > 0 ? `Skipped ${failCount} (already clocked out or failed).` : ""}`);
        setTimeout(() => setSuccess(null), 4000);
        setBusy(false);
        return;
      }

      // Single employee mark logic
      const emp = employees.find((e) => e.uid === markUid);
      const name = emp?.name ?? "Unknown";
      if (markStatus === "clock_out") {
        if (markDate !== new Date().toISOString().slice(0, 10)) {
          setError("You can only clock out an employee for today's date.");
          setBusy(false);
          return;
        }
        const res = await clockOut(markUid, settings, emp);
        if (res.status !== "success") {
          setError(res.message);
          setBusy(false);
          return;
        }
        setMarkOpen(false);
        setSuccess("Employee clocked out successfully!");
        setTimeout(() => setSuccess(null), 3000);
        setBusy(false);
        return;
      }
      await markAttendance(
        markUid,
        name,
        markDate,
        markStatus,
        settings,
        markCheckIn ? new Date(`${markDate}T${markCheckIn}`).toISOString() : null,
        markCheckOut ? new Date(`${markDate}T${markCheckOut}`).toISOString() : null
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

  // Render
  if (loading) {
    return (
      <Box sx={{ px: 4, py: 5 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: { xs: 2, sm: 4, md: 6 }, py: 4 }}>
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
        {!isAdmin && (
          <Button
            variant="contained"
            onClick={() => router.push("/attendance/leaves")}
            sx={{ borderRadius: 3, fontSize: 13 }}
          >
            Request Sick Leave
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

      <OfficeHoursBanner settings={settings} canClock={canClock} />

      {!isAdmin && myStats && (
        <ScrollReveal>
          <EmployeeStatsDashboard myStats={myStats} employee={employee} />
        </ScrollReveal>
      )}

      {!isAdmin && (
        <ScrollReveal>
          <ClockInOutCard 
            myTodayRecord={myTodayRecord}
            canClock={canClock}
            busy={busy}
            handleClockIn={handleClockIn}
            handleClockOut={handleClockOut}
            futureStartDate={employee?.startDate}
          />
        </ScrollReveal>
      )}

      {isAdmin && (
        <AdminFilters 
          employees={employees}
          filterUid={filterUid}
          setFilterUid={setFilterUid}
          filterDepartment={filterDepartment}
          setFilterDepartment={setFilterDepartment}
          filterRole={filterRole}
          setFilterRole={setFilterRole}
          onOpenMarkAttendance={() => {
            setMarkOpen(true);
            setMarkUid(employees.find((e) => e.uid)?.uid ?? "");
            setMarkDate(todayStr);
            setMarkStatus("on_leave");
            setMarkCheckIn("");
            setMarkCheckOut("");
          }}
          onOpenExportAttendance={() => setExportOpen(true)}
        />
      )}

      <ScrollReveal>
        <MonthlySummaryCard 
          summaryMonth={summaryMonth}
          setSummaryMonth={setSummaryMonth}
          summary={summary}
          isAdmin={isAdmin}
          filterUid={filterUid}
          isTargetIntern={isTargetIntern}
        />
      </ScrollReveal>

      {isAdmin && filterUid === "all" ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {employees
            .filter(emp => filterDepartment === "all" || emp.department === filterDepartment)
            .filter(emp => filterRole === "all" || emp.accessLevel === filterRole)
            .map(emp => {
              const todayRecord = records.find(r => r.uid === emp.uid && r.date === todayStr) || null;
              const empMonthRecords = monthRecords.filter(r => r.uid === emp.uid).sort((a, b) => b.date.localeCompare(a.date));
            
              return (
                <ScrollReveal key={emp.id}>
                  <AdminEmployeeCard
                    employee={emp}
                    todayRecord={todayRecord}
                    monthRecords={empMonthRecords}
                    monthTasks={monthTasks}
                    settings={settings}
                    onMarkAttendance={(uid) => {
                      setMarkOpen(true);
                      setMarkUid(uid);
                      setMarkDate(todayStr);
                      setMarkStatus("on_leave");
                      setMarkCheckIn("");
                      setMarkCheckOut("");
                    }}
                  />
                </ScrollReveal>
              );
            })}
        </Box>
      ) : (
        <ScrollReveal>
          <EmployeeAttendanceTable 
            isAdmin={isAdmin}
            displayed={monthRecords}
            employees={employees}
            monthTasks={monthTasks}
            settings={settings}
          />
        </ScrollReveal>
      )}

      <MarkAttendanceModal
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        employees={employees}
        markUid={markUid}
        setMarkUid={setMarkUid}
        markDate={markDate}
        setMarkDate={setMarkDate}
        markStatus={markStatus}
        setMarkStatus={setMarkStatus}
        handleMark={handleMark}
        busy={busy}
      />

      <AttendanceSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        editSettings={editSettings}
        setEditSettings={setEditSettings}
        handleSaveSettings={handleSaveSettings}
        busy={busy}
      />

      <ExportAttendanceModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        employees={employees}
        allRecords={records}
        allTasks={tasks}
        settings={settings || DEFAULT_OFFICE_SETTINGS}
      />
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
          setIsVisible(false);
          if (entry.boundingClientRect.top < 0) {
            setOffsetY(-30);
          } else {
            setOffsetY(30);
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
