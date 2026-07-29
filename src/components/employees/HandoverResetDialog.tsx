"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { resetWorkspaceForHandover, type HandoverResetResult } from "@/lib/data/handover";

interface HandoverResetDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEFAULT_ADMIN_EMAIL = "haseeb.a@ziriumai.com";

export function HandoverResetDialog({
  open,
  onClose,
  onSuccess,
}: HandoverResetDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HandoverResetResult | null>(null);

  const canSubmit = confirmText.trim().toUpperCase() === "RESET" && !busy;

  async function handleReset() {
    setError(null);
    setBusy(true);
    setProgressMsg("Starting database reset...");
    try {
      const res = await resetWorkspaceForHandover(
        DEFAULT_ADMIN_EMAIL,
        (msg) => setProgressMsg(msg)
      );
      setResult(res);
      onSuccess?.();
    } catch (err) {
      console.error("Handover reset failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while resetting the database."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCloseDialog() {
    if (busy) return;
    setConfirmText("");
    setError(null);
    setProgressMsg(null);
    setResult(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleCloseDialog}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 3, p: 1 } },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <WarningAmberIcon color="error" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Reset Workspace DB (Company Handover)
        </Typography>
      </DialogTitle>

      <DialogContent>
        {!result ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Irreversible Database Clean
              </Typography>
              This will permanently delete all employee and intern profiles, attendance history, task reports, work logs, salary sheets, and project records.
              <Box sx={{ mt: 1, fontWeight: 700, color: "error.main" }}>
                ONLY the admin account <code>{DEFAULT_ADMIN_EMAIL}</code> will be preserved.
              </Box>
            </Alert>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {busy && progressMsg && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                }}
              >
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {progressMsg}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Type <Chip label="RESET" size="small" color="error" sx={{ fontWeight: 700 }} /> below to confirm:
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="RESET"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={busy}
                slotProps={{ htmlInput: { style: { fontWeight: 700, textTransform: "uppercase" } } }}
              />
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Alert
              severity="success"
              icon={<CheckCircleIcon />}
              sx={{ borderRadius: 2 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Workspace Reset Complete!
              </Typography>
              The database has been cleanly wiped. Only{" "}
              <strong>{result.keptAdminEmail}</strong> remains as Admin.
            </Alert>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Records Deleted:
            </Typography>
            <Box
              sx={{
                maxHeight: 200,
                overflowY: "auto",
                p: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack divider={<Divider />} spacing={0.75}>
                {Object.entries(result.deletedCounts).map(([col, count]) => (
                  <Box
                    key={col}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 0.5,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      /{col}
                    </Typography>
                    <Chip
                      label={`${count} removed`}
                      size="small"
                      color={count > 0 ? "default" : "default"}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCloseDialog} disabled={busy} sx={{ borderRadius: 2 }}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && (
          <Button
            variant="contained"
            color="error"
            onClick={handleReset}
            disabled={!canSubmit}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            {busy ? "Cleaning DB..." : "Reset Workspace DB"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
