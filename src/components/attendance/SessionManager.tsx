"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { autoClockOutUnclosedShifts, autoClockOutAllUnclosedShifts, subscribeToOfficeSettings, autoFillMissingAttendance, autoFillAllMissingAttendance } from "@/lib/data/attendance";
import { subscribeToPersonalTasks, updatePersonalTask } from "@/lib/data/personal-tasks";
import { shouldNotifyTask } from "@/lib/data/personal-tasks-utils";
import { OfficeSettings, PersonalTask } from "@/lib/data/types";
import { auth } from "@/lib/firebase/client";

export function SessionManager() {
  const { user, employee, role } = useAuth();

  useEffect(() => {
    if (!user) return;

    let currentSettings: OfficeSettings | null = null;
    let currentTasks: PersonalTask[] = [];

    const unsubTasks = subscribeToPersonalTasks(user.uid, (tasks) => {
      currentTasks = tasks;
    });

    const unsubSettings = subscribeToOfficeSettings((settings) => {
      currentSettings = settings;
      if (role === "admin") {
        autoClockOutAllUnclosedShifts(settings).catch(console.error);
        autoFillAllMissingAttendance(settings).catch(console.error);
      } else {
        autoClockOutUnclosedShifts(user.uid, settings).catch(console.error);
        if (employee) {
          autoFillMissingAttendance(employee, settings).catch(console.error);
        }
      }
    });

    const interval = setInterval(async () => {
      if (currentSettings) {
        if (role === "admin") {
          autoClockOutAllUnclosedShifts(currentSettings).catch(console.error);
        } else {
          autoClockOutUnclosedShifts(user.uid, currentSettings).catch(console.error);
        }
      }

      // Check personal tasks for notifications
      const now = new Date();
      const currentDayIndex = now.getDay();
      const todayIso = now.toISOString().slice(0, 10);
      const currentTime = now.getHours() * 60 + now.getMinutes();

      for (const t of currentTasks) {
        if (shouldNotifyTask(t, currentDayIndex, todayIso, currentTime)) {
          // Mark as sent immediately to prevent duplicate triggers
          await updatePersonalTask(t.id, { emailSent: true });

            try {
              const idToken = await auth.currentUser?.getIdToken();
              if (idToken) {
                const res = await fetch("/api/tasks/notify-user", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    userEmail: user.email,
                    userName: user.displayName || employee?.name || "User",
                    taskTitle: t.title,
                    targetTime: t.targetTime,
                    priority: t.priority,
                    category: t.category,
                  }),
                });
                
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}));
                  throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
                }
              }
            } catch (err) {
              console.error("Failed to notify user for task", err);
              // Revert if failed so it tries again
              await updatePersonalTask(t.id, { emailSent: false });
            }
          }
        }

    }, 15 * 1000); // Check every 15 seconds

    return () => {
      unsubSettings();
      unsubTasks();
      clearInterval(interval);
    };
  }, [user, role, employee]);

  return null;
}
