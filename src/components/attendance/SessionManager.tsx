"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { autoClockOutUnclosedShifts, autoClockOutAllUnclosedShifts, subscribeToOfficeSettings, autoFillMissingAttendance, autoFillAllMissingAttendance } from "@/lib/data/attendance";
import { OfficeSettings } from "@/lib/data/types";

export function SessionManager() {
  const { user, employee, role } = useAuth();

  useEffect(() => {
    if (!user) return;

    let currentSettings: OfficeSettings | null = null;

    const unsub = subscribeToOfficeSettings((settings) => {
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

    const interval = setInterval(() => {
      if (currentSettings) {
        if (role === "admin") {
          autoClockOutAllUnclosedShifts(currentSettings).catch(console.error);
        } else {
          autoClockOutUnclosedShifts(user.uid, currentSettings).catch(console.error);
        }
      }
    }, 5 * 60 * 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user, role, employee]);

  return null;
}
