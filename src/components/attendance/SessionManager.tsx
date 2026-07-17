"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { autoClockOutUnclosedShifts, subscribeToOfficeSettings } from "@/lib/data/attendance";
import { OfficeSettings } from "@/lib/data/types";

export function SessionManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let currentSettings: OfficeSettings | null = null;

    // We subscribe to settings to know the closing time.
    const unsub = subscribeToOfficeSettings((settings) => {
      currentSettings = settings;
      // Trigger an immediate check when settings load.
      autoClockOutUnclosedShifts(user.uid, settings).catch(console.error);
    });

    // Also run a check every 5 minutes in case they leave the app open.
    const interval = setInterval(() => {
      if (currentSettings) {
        autoClockOutUnclosedShifts(user.uid, currentSettings).catch(console.error);
      }
    }, 5 * 60 * 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user]);

  return null;
}
