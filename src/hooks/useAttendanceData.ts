import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToDevelopers } from "@/lib/data/developers";
import {
  subscribeToAllAttendance,
  subscribeToMyAttendance,
  subscribeToOfficeSettings,
} from "@/lib/data/attendance";
import { subscribeToAllTasks, subscribeToTasksForEmployee } from "@/lib/data/tasks";
import {
  DEFAULT_OFFICE_SETTINGS,
  type AttendanceRecord,
  type Employee,
  type OfficeSettings,
  type DailyTask,
} from "@/lib/data/types";

export function useAttendanceData() {
  const { user, isAdmin, employee, role } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<OfficeSettings>(DEFAULT_OFFICE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load office settings.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToOfficeSettings(
      (s) => setSettings(s),
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
      (devs) => setEmployees((devs ?? []).filter(d => d.accessLevel !== "admin")),
      (err) => console.error("Employees error:", err)
    );
    return unsub;
  }, [user]);

  // Subscribe to attendance records.
  useEffect(() => {
    if (!user) return;
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

  // Subscribe to tasks. Admins need all tasks for overtime calculation.
  useEffect(() => {
    if (isAdmin) {
      return subscribeToAllTasks((t) => setTasks(t));
    } else {
      if (!employee) return;
      return subscribeToTasksForEmployee(employee.id, (t) => setTasks(t));
    }
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

  return { records, tasks, employees, settings, loading, error, setError, user, isAdmin, employee };
}
