"use client";

import { useEffect, useState, useMemo } from "react";
import { subscribeToAnnouncements } from "@/lib/data/announcements";
import type { Announcement } from "@/lib/data/types";
import { useAuth } from "@/lib/firebase/auth-context";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";
import { blue, dark, neutral, brand, light } from "@/lib/theme/colors";

import { keyframes } from "@emotion/react";

const ringAnimation = keyframes`
  0% { transform: rotate(0); }
  25% { transform: rotate(0); } /* Wait 1 sec (25% of 4s) */
  30% { transform: rotate(15deg); }
  35% { transform: rotate(-10deg); }
  40% { transform: rotate(5deg); }
  45% { transform: rotate(-5deg); }
  50% { transform: rotate(0); }
  100% { transform: rotate(0); } /* Stay still for rest of 4s */
`;

const rippleAnimation = keyframes`
  0% { box-shadow: 0 0 15px rgba(33, 150, 243, 0.2), 0 0 0 0 rgba(33, 150, 243, 0.4); }
  25% { box-shadow: 0 0 15px rgba(33, 150, 243, 0.2), 0 0 0 0 rgba(33, 150, 243, 0.4); }
  35% { box-shadow: 0 0 15px rgba(33, 150, 243, 0.2), 0 0 0 10px rgba(33, 150, 243, 0); }
  100% { box-shadow: 0 0 15px rgba(33, 150, 243, 0.2), 0 0 0 0 rgba(33, 150, 243, 0); }
`;

export function GlobalBanner() {
  const { user, isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);
  const [tick, setTick] = useState(0);
  const { mode } = useColorScheme();
  const isLight = mode === "light";

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
        width: "100%",
        background: isLight 
          ? `linear-gradient(90deg, ${light.surface} 0%, ${blue[50]} 50%, ${light.surface} 100%)`
          : `linear-gradient(90deg, ${dark.surface} 0%, ${blue[900]}44 50%, ${dark.surface} 100%)`,
        color: isLight ? neutral[900] : brand.white,
        p: { xs: 1.5, md: 2 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: `1px solid ${isLight ? blue[100] : blue[400] + "22"}`,
        boxShadow: isLight ? `0 4px 15px rgba(0,0,0,0.05)` : `0 4px 30px rgba(0,0,0,0.5)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Premium Glass Edge Highlight */}
      <Box
        sx={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${blue[400]}88, transparent)`
        }}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 2, md: 3 }, width: "100%", maxWidth: "1400px" }}>

        {/* Left Side: Icon & Badge */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "10px",
            background: `linear-gradient(135deg, ${blue[400]}22, ${blue[500]}44)`,
            border: `1px solid ${blue[400]}44`,
            flexShrink: 0,
            animation: `${rippleAnimation} 4s ease-in-out infinite`,
            transformOrigin: "center"
          }}>
            <Box
              component="svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isLight ? blue[600] : blue[100]}
              sx={{
                animation: `${ringAnimation} 4s ease-in-out infinite`,
                transformOrigin: "top center"
              }}
            >
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </Box>
          </Box>
          <Typography
            variant="overline"
            sx={{
              color: blue[300],
              fontWeight: 800,
              letterSpacing: 1.5,
              lineHeight: 1,
              display: { xs: "none", sm: "block" }
            }}
          >
            UPDATE
          </Typography>
        </Box>

        {/* Divider line */}
        <Box sx={{ width: "1px", height: "32px", bgcolor: `${blue[400]}33`, display: { xs: "none", sm: "block" } }} />

        {/* Center: Title & Description */}
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, overflow: "hidden" }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: "1.05rem",
              color: isLight ? neutral[900] : brand.white,
              textShadow: isLight ? "none" : `0 0 12px ${blue[400]}44`,
              letterSpacing: 0.3
            }}
          >
            {current.title}
          </Typography>
          {current.description && (
            <Typography variant="body2" sx={{ color: isLight ? neutral[600] : blue[100], opacity: 0.8, mt: 0.2, fontWeight: 400, wordBreak: "break-word" }}>
              {current.description}
            </Typography>
          )}
        </Box>

        {/* Right Side: Controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {activeAnnouncements.length > 1 && (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mr: 1, bgcolor: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.3)", borderRadius: "8px", px: 1, border: `1px solid ${isLight ? neutral[200] : neutral[800]}` }}>
              <IconButton
                size="small"
                onClick={() => setCurrentIndex((prev) => (prev - 1 + activeAnnouncements.length) % activeAnnouncements.length)}
                sx={{ color: isLight ? neutral[600] : neutral[400], p: 0.5, flexShrink: 0, "&:hover": { color: isLight ? blue[600] : blue[300] } }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                </svg>
              </IconButton>
              <Typography variant="caption" sx={{ color: isLight ? neutral[600] : neutral[400], fontWeight: 600, minWidth: 32, textAlign: "center" }}>
                {currentIndex + 1}/{activeAnnouncements.length}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length)}
                sx={{ color: isLight ? neutral[600] : neutral[400], p: 0.5, flexShrink: 0, "&:hover": { color: isLight ? blue[600] : blue[300] } }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </IconButton>
            </Box>
          )}

          <IconButton
            size="small"
            onClick={() => setDismissedUntil(Date.now())}
            sx={{
              color: isLight ? neutral[600] : neutral[400],
              bgcolor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
              "&:hover": { bgcolor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)", color: isLight ? neutral[900] : brand.white },
              ml: 1,
              transition: "all 0.2s ease",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
