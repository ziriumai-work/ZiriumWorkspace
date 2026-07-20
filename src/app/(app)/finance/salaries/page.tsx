"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { blue, orange, green } from "@/lib/theme/colors";
import { useAuth } from "@/lib/firebase/auth-context";
import { useUpload } from "@/lib/contexts/UploadContext";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { AlertColor } from "@mui/material/Alert";
import {
  generateSalariesForMonth,
  subscribeToSalariesByMonth,
  subscribeToMySalaries,
  markSalaryPaid,
  markSalaryFulfilled,
} from "@/lib/data/salaries";
import type { SalaryRecord, SalaryLineItem } from "@/lib/data/types";
import { getAuth } from "firebase/auth";

export default function SalariesPage() {
  const { user, isAdmin, employee } = useAuth();
  const developerId = employee?.id;
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  // For Admin: Month picker
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Payment Dialog state
  const [payDialogFor, setPayDialogFor] = useState<SalaryRecord | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const { uploadFile } = useUpload();

  // Toast and Confirm state
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<AlertColor>("success");
  const [confirmReceiveId, setConfirmReceiveId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    let unsub: () => void;
    
    if (isAdmin) {
      unsub = subscribeToSalariesByMonth(
        selectedMonth,
        (data) => {
          setSalaries(data);
          setLoading(false);
        },
        (err) => {
          setError(`[Subscribe Admin] ${err.message || "Failed to load salaries."}`);
          setLoading(false);
        }
      );
    } else {
      if (developerId) {
        unsub = subscribeToMySalaries(
          developerId,
          (data) => {
            setSalaries(data);
            setLoading(false);
          },
          (err) => {
            setError(`[Subscribe Member] ${err.message || "Failed to load salaries."}`);
            setLoading(false);
          }
        );
      } else {
        setLoading(false);
      }
    }

    // Fallback timeout in case onSnapshot never fires (e.g. permission error without catch)
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      if (unsub) unsub();
      clearTimeout(timeout);
    };
  }, [isAdmin, developerId, selectedMonth]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateSalariesForMonth(selectedMonth);
    } catch (err) {
      console.error(err);
      setError(`[Generate Salaries] ${err instanceof Error ? err.message : "Failed to generate salaries."}`);
    }
    setGenerating(false);
  };

  const handlePay = async () => {
    if (!payDialogFor || !receiptFile) return;
    setPaying(true);
    try {
      const path = `finance/salaries/${payDialogFor.id}_${Date.now()}`;
      const fileData = await uploadFile(path, receiptFile);
      await markSalaryPaid(payDialogFor.id, fileData.url);
      setPayDialogFor(null);
      setReceiptFile(null);
      setToastType("success");
      setToast("Receipt uploaded and marked as paid!");
    } catch (err) {
      console.error(err);
      setToastType("error");
      setToast("Failed to upload receipt and mark as paid.");
    }
    setPaying(false);
  };

  const handleReceive = async () => {
    if (!confirmReceiveId) return;
    try {
      await markSalaryFulfilled(confirmReceiveId);
      setToastType("success");
      setToast("Salary marked as received!");
    } catch (err) {
      console.error(err);
      setToastType("error");
      setToast("Failed to mark as received.");
    }
    setConfirmReceiveId(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const formatPKR = (amount: number) => `Rs ${amount.toLocaleString()}`;

  const renderLineItems = (items: SalaryLineItem[]) => {
    if (items.length === 0) return null;
    return (
      <Box sx={{ mt: 2, mb: 2, display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, mb: 0.5 }}>
          Adjustments
        </Typography>
        {items.map((item, idx) => (
          <Box 
            key={idx} 
            sx={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              p: 1, 
              px: 1.5,
              bgcolor: "background.paper", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider"
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: "0.8rem" }}>
                {item.description.startsWith("Overtime:") ? "Overtime" : item.description}
              </Typography>
              {item.dateStr && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", mt: -0.2 }}>
                  {item.dateStr}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 800,
                  color: item.amount < 0 ? "#D32F2F" : "#2EA26E" 
                }}
              >
                {item.amount > 0 ? "+" : item.amount < 0 ? "-" : ""}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ fontWeight: 600, fontStyle: "italic", color: "text.primary" }}
              >
                {formatPKR(Math.abs(item.amount))}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  const renderCard = (s: SalaryRecord) => {
    const isDue = s.status === "due";
    const isPaid = s.status === "paid";
    const isFulfilled = s.status === "fulfilled";

    return (
      <Grid item xs={12} md={6} key={s.id}>
        <Card 
          variant="outlined" 
          sx={{ 
            height: "100%", 
            display: "flex", 
            flexDirection: "column", 
            borderRadius: 3, 
            borderColor: "divider",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-4px)",
              borderColor: isDue ? orange.main : isPaid ? blue[400] : isFulfilled ? green.main : "primary.main",
              boxShadow: isDue 
                ? `0 8px 24px ${orange.main}40` 
                : isPaid
                  ? `0 8px 24px ${blue[400]}40`
                  : isFulfilled
                    ? `0 8px 24px ${green.main}40`
                    : "0 8px 24px rgba(25, 118, 210, 0.15)",
            }
          }}
        >
          <CardContent sx={{ flex: 1, p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ color: blue[400], fontWeight: 700, mb: 0.5, wordBreak: "break-word" }}>
                  {isAdmin ? s.employeeName : `Month: ${s.month}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isAdmin ? `Salary Month: ${s.month}` : "Your Salary Details"}
                </Typography>
              </Box>
              <Chip
                label={isDue ? "Payment Due" : isPaid ? "Pending Receive" : "Fulfilled"}
                color={isDue ? "warning" : isPaid ? "info" : "success"}
                size="small"
                sx={{ fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Base Salary</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{formatPKR(s.baseSalary)}</Typography>
            </Box>

            {s.lineItems.length > 0 && renderLineItems(s.lineItems)}

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 3, pt: 2, borderTop: "2px dashed", borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.secondary" }}>Net Total</Typography>
              <Typography variant="h6" color="success.main" sx={{ fontWeight: 800 }}>{formatPKR(s.netSalary)}</Typography>
            </Box>

            {s.receiptUrl && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Payment Receipt:
                </Typography>
                <a href={s.receiptUrl} target="_blank" rel="noreferrer">
                  <img src={s.receiptUrl} alt="Receipt" style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 4, border: "1px solid #ccc" }} />
                </a>
              </Box>
            )}

            {isPaid && !isAdmin && (
              <Button
                variant="contained"
                onClick={() => setConfirmReceiveId(s.id)}
                fullWidth
                sx={{
                  mt: 3,
                  py: 1.2,
                  borderRadius: 2,
                  bgcolor: "info.main",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "info.dark" },
                }}
              >
                Confirm Receipt
              </Button>
            )}
          </CardContent>

          <CardActions sx={{ p: 2, pt: 0, justifyContent: "flex-end" }}>
            {isAdmin && isDue && (
              <Button variant="contained" size="small" onClick={() => setPayDialogFor(s)}>
                Pay
              </Button>
            )}
          </CardActions>
        </Card>
      </Grid>
    );
  };

  const dueSalaries = salaries.filter(s => s.status === "due");
  const fulfilledSalaries = salaries.filter(s => s.status !== "due");

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 4 }}>
      {isAdmin && (
        <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <TextField
            type="month"
            label="Salary Month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={generating}
            sx={{ height: 40 }}
          >
            {generating ? <CircularProgress size={20} color="inherit" /> : "Generate Salaries"}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      )}

      {salaries.length === 0 ? (
        <Typography color="text.secondary">No salaries found for this selection.</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {isAdmin ? (
            <>
              {dueSalaries.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>Due Salaries</Typography>
                  <Grid container spacing={2}>
                    {dueSalaries.map(renderCard)}
                  </Grid>
                </Box>
              )}
              {fulfilledSalaries.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>Paid / Fulfilled</Typography>
                  <Grid container spacing={2}>
                    {fulfilledSalaries.map(renderCard)}
                  </Grid>
                </Box>
              )}
            </>
          ) : (
            <Grid container spacing={2}>
              {salaries.map(renderCard)}
            </Grid>
          )}
        </Box>
      )}

      {/* Payment Dialog */}
      <Dialog open={!!payDialogFor} onClose={() => setPayDialogFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark as Paid</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload the payment screenshot or receipt for {payDialogFor?.employeeName}.
          </Typography>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }}>
            Choose File
            <input type="file" hidden accept="image/*" onChange={(e: any) => setReceiptFile(e.target.files?.[0] || null)} />
          </Button>
          {receiptFile && (
            <Typography variant="caption" sx={{ display: "block", textAlign: "center" }}>
              {receiptFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialogFor(null)} color="inherit">Cancel</Button>
          <Button onClick={handlePay} disabled={!receiptFile || paying} variant="contained">
            {paying ? "Paying..." : "Confirm Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmReceiveId)}
        title="Confirm Receipt"
        message="Are you sure you have received this salary? This will log it as a company expense."
        type="info"
        confirmLabel="Yes, Received"
        cancelLabel="Cancel"
        onConfirm={handleReceive}
        onCancel={() => setConfirmReceiveId(null)}
      />

      <Toast
        open={Boolean(toast)}
        message={toast ?? ""}
        type={toastType}
        onClose={() => setToast(null)}
      />
    </Box>
  );
}
