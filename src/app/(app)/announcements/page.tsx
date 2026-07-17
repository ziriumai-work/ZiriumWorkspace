"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToAnnouncements, createAnnouncement, deleteAnnouncement } from "@/lib/data/announcements";
import type { Announcement } from "@/lib/data/types";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToAnnouncements(
      (data) => setAnnouncements(data),
      (err) => console.error(err)
    );
    return unsub;
  }, [user]);

  async function handleCreate() {
    if (!title.trim() || !user) return;
    setSubmitting(true);
    try {
      await createAnnouncement({
        title: title.trim(),
        description: description.trim(),
        expiryDate: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : null,
        createdBy: user.uid,
      });
      setTitle("");
      setDescription("");
      setHasExpiry(false);
      setExpiryDate("");
    } catch (err) {
      console.error(err);
      alert("Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteAnnouncement(id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: "-0.02em" }}>
        Announcements
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Broadcast messages to the entire workspace. Active announcements appear as a global banner for all users.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: "surface" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          Create New Announcement
        </Typography>
        
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <TextField
            label="Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Office closed on Friday"
          />
          <TextField
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide more details here..."
          />
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <FormControlLabel
              control={<Switch checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />}
              label="Set Expiration"
            />
            {hasExpiry && (
              <TextField
                type="datetime-local"
                size="small"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                sx={{ width: 250 }}
              />
            )}
          </Box>

          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !title.trim()}
            sx={{ alignSelf: "flex-start", px: 4, py: 1.5, borderRadius: 3, fontWeight: 600 }}
          >
            {submitting ? "Publishing..." : "Publish Announcement"}
          </Button>
        </Box>
      </Paper>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Manage Announcements
      </Typography>
      
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {announcements.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 4, borderStyle: "dashed" }}>
            <Typography color="text.secondary">No announcements have been created yet.</Typography>
          </Paper>
        ) : (
          announcements.map((a) => {
            const isExpired = a.expiryDate && new Date(a.expiryDate) < new Date();
            
            return (
              <Paper key={a.id} variant="outlined" sx={{ p: 3, borderRadius: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                  <Box sx={{ flex: 1, overflow: "hidden" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: "break-word" }}>{a.title}</Typography>
                      {isExpired ? (
                        <Chip size="small" label="Expired" sx={{ bgcolor: "#ef444422", color: "#ef4444", fontWeight: 600 }} />
                      ) : (
                        <Chip size="small" label="Active" sx={{ bgcolor: "#22c55e22", color: "#22c55e", fontWeight: 600 }} />
                      )}
                    </Box>
                    {a.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {a.description}
                      </Typography>
                    )}
                  </Box>
                  
                  <IconButton onClick={() => handleDelete(a.id)} color="error" size="small" sx={{ flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </IconButton>
                </Box>
                
                <Divider />
                
                <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Created: {a.createdAt ? new Date((a.createdAt as any).toMillis?.() || Date.now()).toLocaleString() : "Just now"}
                  </Typography>
                  {a.expiryDate && (
                    <Typography variant="caption" color="text.secondary">
                      Expires: {new Date(a.expiryDate).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              </Paper>
            );
          })
        )}
      </Box>
    </Box>
  );
}
