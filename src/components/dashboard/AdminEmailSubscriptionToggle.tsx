"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";

export function AdminEmailSubscriptionToggle() {
  const { user, employee, member, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [localSubscribed, setLocalSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    setLocalSubscribed(null);
  }, [user?.uid]);

  if (!isAdmin) return null;

  const isSubscribed =
    localSubscribed !== null
      ? localSubscribed
      : Boolean(employee?.subscribeToEmails || member?.subscribeToEmails);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    setLocalSubscribed(nextVal);
    setLoading(true);
    try {
      // Update developer profile if present
      if (employee?.id) {
        await setDoc(
          doc(db, "developers", employee.id),
          {
            subscribeToEmails: nextVal,
            email: user?.email || employee.email || "",
          },
          { merge: true }
        );
      }
      // Also update member doc
      if (user?.uid) {
        await setDoc(
          doc(db, "members", user.uid),
          {
            subscribeToEmails: nextVal,
            email: user.email || "",
          },
          { merge: true }
        );
      }
      console.log("Admin email subscription saved to Firestore:", nextVal);
    } catch (error) {
      console.error("Failed to save email subscription setting to Firestore:", error);
      setLocalSubscribed(!nextVal);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        ml: "auto",
        bgcolor: "background.paper",
        p: 0.75,
        px: 2,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        boxShadow: 1,
      }}
    >
      <Tooltip title="Subscribe to email to get the clock in/out emails">
        <FormControlLabel
          control={
            <Switch
              checked={isSubscribed}
              onChange={handleToggle}
              disabled={loading}
              color="primary"
              size="small"
            />
          }
          label={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                fontSize: 13,
                fontWeight: 600,
                color: "text.primary",
              }}
            >
              Subscribe to emails
              {loading && <CircularProgress size={12} />}
            </Box>
          }
          sx={{ mr: 0 }}
        />
      </Tooltip>
    </Box>
  );
}

