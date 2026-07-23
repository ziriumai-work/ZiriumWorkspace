"use client";

// Finance → Money Allotment: month by month, record where the money goes.
// Every entry is an expense, so amounts always render red with a − sign.
// The same entries feed the shared available-balance formula used by the
// dashboard and the monthly sheet, in real time.

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import Tooltip from "@mui/material/Tooltip";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CloseIcon from "@mui/icons-material/Close";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { Money } from "@/components/finance/Money";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import {
  addAllotment,
  currentMonth,
  deleteAllotment,
  subscribeToAllotments,
  subscribeToInvoices,
  updateAllotment,
  updateInvoice,
  formatAmount,
  type Allotment,
  type Invoice,
} from "@/lib/data/finance";

export default function AllotmentPage() {
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Allotment | null>(null);

  // Form state.
  const [month, setMonth] = useLocalStorage("zirium_draft_allot_month", currentMonth());
  const [label, setLabel] = useLocalStorage("zirium_draft_allot_label", "");
  const [amount, setAmount] = useLocalStorage("zirium_draft_allot_amount", "");
  const [note, setNote] = useLocalStorage("zirium_draft_allot_note", "");
  const [linkedInvoices, setLinkedInvoices] = useLocalStorage<{ inv: Invoice; rate: string }[]>("zirium_draft_allot_linked", []);

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubInvoices = subscribeToInvoices((inv) => setInvoices(inv));
    const unsubAllotments = subscribeToAllotments(
      (a) => {
        setAllotments(a);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => {
      unsubInvoices();
      unsubAllotments();
    };
  }, []);

  const uniqueSections = useMemo(
    () => Array.from(new Set(allotments.map((a) => a.label))),
    [allotments],
  );

  const monthEntries = useMemo(
    () => allotments.filter((a) => a.month === month),
    [allotments, month],
  );
  const monthTotal = monthEntries.reduce((s, a) => s + a.amount, 0);

  // Compute how much of an invoice has been used by allotments
  const getInvoiceUsed = (invoiceId: string) => {
    return allotments.reduce((sum, a) => {
      const found = (a.invoices || []).find((ai) => ai.id === invoiceId);
      return sum + (found ? found.amountUsed : 0);
    }, 0);
  };

  const getOutstanding = (inv: Invoice) => {
    const used = getInvoiceUsed(inv.id);
    return Math.max(0, (inv.actualReceived || 0) - used);
  };

  const availableInvoices = useMemo(() => {
    return invoices.filter((inv) => getOutstanding(inv) > 0);
  }, [invoices, allotments]);

  const computedAmount = useMemo(() => {
    return linkedInvoices.reduce((sum, item) => {
      const outstanding = getOutstanding(item.inv);
      const rate = Number(item.rate) || 1; // Default to 1 if PKR or missing
      return sum + outstanding * rate;
    }, 0);
  }, [linkedInvoices, allotments]);

  async function add() {
    if (!label.trim()) {
      setError("Write where the money goes (a section name).");
      return;
    }
    const finalAmount = linkedInvoices.length > 0 ? computedAmount : Number(amount);
    if (!finalAmount || finalAmount <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Save exchange rates to the invoice if provided and not PKR
      for (const item of linkedInvoices) {
        if (item.inv.currency !== "PKR" && item.rate) {
          await updateInvoice(item.inv.id, { exchangeRateToPkr: Number(item.rate) });
        }
      }

      await addAllotment({
        month,
        label: label.trim(),
        amount: finalAmount,
        note: note.trim(),
        invoices: linkedInvoices.map((item) => ({
          id: item.inv.id,
          number: item.inv.number,
          currency: item.inv.currency,
          amountUsed: getOutstanding(item.inv),
          exchangeRate: Number(item.rate) || 1,
        })),
      });
      setLabel("");
      setAmount("");
      setNote("");
      setLinkedInvoices([]);
      setToast("Allotment added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add allotment");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteAllotment(toDelete.id);
    setToDelete(null);
    setToast("Allotment removed");
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: 4, py: 4 }}>
      {/* Month selector + add form */}
      <ScrollReveal>
        <Paper variant="outlined" sx={{ p: 5, borderRadius: 4 }}>
          <Typography variant="body2" sx={{ mb: 3, fontWeight: 500 }}>
            Allot money for a month
          </Typography>
          <Grid container spacing={3}>
            {/* First Row */}
            <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
              <TextField
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                label="Month"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, lg: 4 }}>
              <Autocomplete
                freeSolo
                options={uniqueSections}
                value={label}
                onInputChange={(_, v) => setLabel(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Section — where it goes *"
                    placeholder="e.g. Marketing, Salaries pool"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3, lg: 3 }}>
              <TextField
                value={linkedInvoices.length > 0 ? computedAmount : amount}
                onChange={(e) => setAmount(e.target.value)}
                label="Amount (PKR) *"
                type="number"
                fullWidth
                disabled={linkedInvoices.length > 0}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 2, lg: 3 }}>
              <Button
                variant="outlined"
                fullWidth
                sx={{ height: 56, textTransform: "none" }}
                startIcon={<EditNoteIcon />}
                onClick={() => setNoteDialogOpen(true)}
              >
                {note ? "Edit Note" : "Add Note"}
              </Button>
            </Grid>

            {/* Second Row: Invoices Linkage */}
            <Grid size={12}>
              <Autocomplete
                multiple
                options={availableInvoices}
                getOptionLabel={(o) => `${o.number} — ${o.currency} ${formatAmount(getOutstanding(o))} outstanding`}
                value={linkedInvoices.map((i) => i.inv)}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                onChange={(_, vals) => {
                  const newArr = vals.map((inv) => {
                    const existing = linkedInvoices.find((l) => l.inv.id === inv.id);
                    return existing || { inv, rate: inv.exchangeRateToPkr ? String(inv.exchangeRateToPkr) : "" };
                  });
                  setLinkedInvoices(newArr);
                }}
                sx={{ "& .MuiAutocomplete-tag": { display: "none" } }}
                renderInput={(params) => (
                  <TextField {...params} label="Link Invoices (Source of funds)" placeholder="Select invoices to use..." />
                )}
              />
              {linkedInvoices.length > 0 && (
                <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 2 }}>
                  {linkedInvoices.map((item, index) => {
                    const outstanding = getOutstanding(item.inv);
                    return (
                      <Paper key={item.inv.id} variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", gap: 3, borderRadius: 3 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.inv.number}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.inv.currency} {formatAmount(outstanding)} available
                          </Typography>
                        </Box>
                        {item.inv.currency !== "PKR" && (
                          <TextField
                            size="small"
                            label={`Rate to PKR`}
                            type="number"
                            value={item.rate}
                            onChange={(e) => {
                              const newArr = [...linkedInvoices];
                              newArr[index].rate = e.target.value;
                              setLinkedInvoices(newArr);
                            }}
                            sx={{ width: 120 }}
                          />
                        )}
                        <IconButton size="small" onClick={() => setLinkedInvoices(linkedInvoices.filter((_, i) => i !== index))}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Grid>
          
            <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
              <Button onClick={add} disabled={saving} variant="contained" sx={{ px: 4 }}>
                {saving ? "Adding…" : "Add Allotment"}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </ScrollReveal>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Month summary + entries */}
      <Box sx={{ mt: 3, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2">
          {new Date(month + "-01").toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}{" "}
          — {monthEntries.length} {monthEntries.length === 1 ? "section" : "sections"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total allotted this month: <Money value={monthTotal} balance variant="body2" />
        </Typography>
      </Box>

      <ScrollReveal>
        <Paper variant="outlined" sx={{ mt: 1.5, borderRadius: 3, overflowX: "auto" }}>
          <Table sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "surface" }}>
              <TableCell>Section</TableCell>
              <TableCell>Note</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <CircularProgress size={18} />
                </TableCell>
              </TableRow>
            ) : monthEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    Nothing allotted for this month yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              monthEntries.map((a) => (
                <TableRow
                  key={a.id}
                  hover
                  sx={{
                    transition: "all 0.2s ease-in-out",
                    position: "relative",
                    "& .row-actions": { opacity: 0 },
                    "&:hover": {
                      bgcolor: "action.hover",
                      "& td": { color: "primary.main" },
                      "& td:first-of-type": {
                        boxShadow: "inset 3px 0 0 0 var(--mui-palette-primary-main)"
                      },
                      "& .row-actions": { opacity: 1 },
                    }
                  }}
                >
                  <TableCell sx={{ minWidth: 160 }}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                      <EditableText
                        value={a.label}
                        bold
                        onCommit={(v) => v.trim() && updateAllotment(a.id, { label: v.trim() })}
                      />
                      {(a.invoices || []).map((inv) => (
                        <Chip key={inv.id} label={inv.number} size="small" sx={{ fontSize: 10, height: 18 }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ minWidth: 80 }}>
                    {a.note ? (
                      <Tooltip title={a.note}>
                        <IconButton size="small">
                          <InfoIcon fontSize="small" color="info" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ width: 160 }}>
                    <EditableExpense
                      value={a.amount}
                      onCommit={(v) => updateAllotment(a.id, { amount: v })}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 60 }}>
                    <IconButton
                      className="row-actions"
                      size="small"
                      onClick={() => setToDelete(a)}
                      sx={{
                        color: "text.secondary",
                        transition: "opacity 0.15s",
                        "&:hover": { color: "error.main" },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
      </ScrollReveal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove allotment"
        message={`Remove "${toDelete?.label}" from ${toDelete?.month}?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            margin="dense"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            helperText={`${note.length}/300`}
            placeholder="Enter up to 300 characters..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </Box>
  );
}

function EditableText({
  value,
  bold,
  placeholder,
  onCommit,
}: {
  value: string;
  bold?: boolean;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(value);
  }
  return (
    <InputBase
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      fullWidth
      sx={{ fontSize: 14, fontWeight: bold ? 500 : 400 }}
    />
  );
}

// Editable amount that always displays as a red − expense when not focused.
function EditableExpense({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <Box
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        sx={{ cursor: "text", display: "inline-block" }}
        title="Click to edit"
      >
        <Money value={value} balance variant="body2" />
      </Box>
    );
  }
  return (
    <InputBase
      autoFocus
      value={draft}
      type="number"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        setEditing(false);
        if (n > 0 && n !== value) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      sx={{
        fontSize: 14,
        maxWidth: 120,
        "& input": { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      }}
    />
  );
}
