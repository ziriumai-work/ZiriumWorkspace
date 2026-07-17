"use client";

import { useEffect, useState, useMemo } from "react";
import { subscribeToAnnouncements } from "@/lib/data/announcements";
import type { Announcement } from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/auth-context";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

export function GlobalBanner() {
  const { user, isAdmin, role } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);
  const [tick, setTick] = useState(0);

  // Force re-evaluation of active announcements every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToAnnouncements(
      (data) => setAnnouncements(data),
      (err) => console.error("Failed to load announcements:", err)
    );
    return unsub;
  }, [user]);

  // Active announcements: not expired, and newer than our dismissal time (if any).
  // Also we want to hide it if they clicked dismiss in this session, unless a new one arrived.
  const activeAnnouncements = useMemo(() => {
    const now = new Date();
    return announcements.filter((a) => {
      // 1. Check expiration
      if (a.expiryDate && new Date(a.expiryDate) < now) {
        return false;
      }
      // 2. Check dismissal (if created after dismissal, show it)
      // If we dismissed at timestamp X, and the announcement createdAt > X, we show it.
      // Wait, createdAt can be null initially (serverTimestamp). Treat null as "just created" = very new.
      const createdAtMs = a.createdAt ? (a.createdAt as any).toMillis?.() || Date.now() : Date.now();
      if (createdAtMs <= dismissedUntil) {
        return false;
      }
      return true;
    });
  }, [announcements, dismissedUntil, tick]);

  // Reset index if bounds changed
  useEffect(() => {
    if (currentIndex >= activeAnnouncements.length && activeAnnouncements.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeAnnouncements.length, currentIndex]);

  // Auto-cycle every 10 seconds
  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeAnnouncements.length]);

  if (isAdmin || activeAnnouncements.length === 0) {
    return null; // Admin does not see the global banner
  }

  const current = activeAnnouncements[currentIndex];
  if (!current) return null;

  return (
    <Box
      sx={{
        bgcolor: "#1e1e2d",
        color: "white",
        p: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        borderBottom: "1px solid #3b82f633",
        borderTop: "3px solid #3b82f6",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflow: "hidden" }}>
        {activeAnnouncements.length > 1 && (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <IconButton 
              size="small" 
              onClick={() => setCurrentIndex((prev) => (prev - 1 + activeAnnouncements.length) % activeAnnouncements.length)}
              sx={{ color: "rgba(255,255,255,0.7)", p: 0.5, flexShrink: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </IconButton>
            <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 600, flexShrink: 0 }}>
              {currentIndex + 1} / {activeAnnouncements.length}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length)}
              sx={{ color: "rgba(255,255,255,0.7)", p: 0.5, flexShrink: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </IconButton>
          </Box>
        )}
        
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, overflow: "hidden" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "1.1rem", lineHeight: 1.2, wordBreak: "break-word" }}>
            {current.title}
          </Typography>
          {current.description && (
            <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5, lineHeight: 1.3, wordBreak: "break-word" }}>
              {current.description}
            </Typography>
          )}
        </Box>
      </Box>

      <IconButton
        onClick={() => {
          // Dismiss everything up to right now
          setDismissedUntil(Date.now());
        }}
        sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </IconButton>
    </Box>
  );
}
