"use client";

import { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  CircularProgress,
  Chip,
  Paper,
  Divider
} from "@mui/material";
import MuiLink from "@mui/material/Link";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useAuth } from "@/lib/firebase/auth-context";
import { getCompanyDocument, GUIDELINES_EMPLOYEE_ID, GUIDELINES_INTERN_ID } from "@/lib/data/documents";
import { markWelcomeSeen } from "@/lib/data/members";
import type { CompanyDocument } from "@/lib/data/types";
import Markdown from "react-markdown";
import { Toast } from "@/components/ui/Toast";

export function WelcomeScreen() {
  const { user, member, role, isAdmin } = useAuth();
  const [doc, setDoc] = useState<CompanyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [closedOptimistically, setClosedOptimistically] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  // Determine if we should show the modal
  const shouldShow = !!user && !!member && !member.hasSeenWelcome && !isAdmin && role !== null && !closedOptimistically;

  useEffect(() => {
    if (!shouldShow) return;
    
    async function fetchDoc() {
      try {
        const docId = role === "intern" ? GUIDELINES_INTERN_ID : GUIDELINES_EMPLOYEE_ID;
        const fetched = await getCompanyDocument(docId);
        setDoc(fetched);
      } catch (err) {
        console.error("Failed to load guidelines:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [shouldShow, role]);

  if (!shouldShow) return null;

  const handleAcknowledge = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await markWelcomeSeen(user.uid);
      setClosedOptimistically(true);
    } catch (err: any) {
      console.error("Failed to mark welcome seen:", err);
      setToastError(err.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog 
      open={true} 
      fullWidth 
      maxWidth="md"
      // Prevent closing by clicking outside or pressing escape
      sx={{ '& .MuiDialog-paper': { borderRadius: 4, m: 2 } }}
    >
      <Box sx={{ p: 4, pb: 2, bgcolor: "background.paper" }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: "primary.main" }}>
          Welcome to Zirium!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Please review the following rules and guidelines before accessing your workspace.
        </Typography>
      </Box>

      <Divider />

      <DialogContent sx={{ p: 4, minHeight: 300, bgcolor: "surface" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : doc ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Box sx={{ '& h1, & h2, & h3': { mt: 0, mb: 2 }, '& p': { mb: 2, lineHeight: 1.6 }, '& ul, & ol': { mt: 0, mb: 2, pl: 3 } }}>
              <Markdown>{doc.content || "*No guidelines provided yet.*"}</Markdown>
            </Box>

            {((doc.links && doc.links.length > 0) || (doc.files && doc.files.length > 0)) && (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Required Reading & Attachments
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {doc.links?.map((link, i) => (
                    <Chip
                      key={i}
                      label={new URL(link).hostname}
                      component="a"
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      sx={{ bgcolor: "primary.main", color: "white", fontWeight: 500, '&:hover': { bgcolor: "primary.dark" } }}
                    />
                  ))}
                  {doc.files?.map((f, i) => (
                    <Chip
                      key={i}
                      icon={<AttachFileIcon sx={{ fontSize: "16px !important" }} />}
                      label={f.name}
                      component="a"
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  ))}
                </Box>
              </Paper>
            )}
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 8 }}>
            No guidelines have been set up by the admin yet.
          </Typography>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, bgcolor: "background.paper" }}>
        <Button 
          variant="contained" 
          size="large" 
          fullWidth 
          onClick={handleAcknowledge}
          disabled={saving}
          sx={{ borderRadius: 3, py: 1.5, fontSize: "1rem", fontWeight: 600 }}
        >
          {saving ? <CircularProgress size={24} color="inherit" /> : "I have read and agree to the guidelines"}
        </Button>
      </DialogActions>

      {/* Render Toast for error */}
      {toastError && (
        <Toast
          open={!!toastError}
          message={toastError}
          type="error"
          onClose={() => setToastError(null)}
        />
      )}
    </Dialog>
  );
}
