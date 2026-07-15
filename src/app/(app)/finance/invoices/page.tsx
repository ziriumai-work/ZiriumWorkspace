"use client";

// Finance → Invoices: build an invoice from categorized line items with a
// currency choice, store it (with timestamp), and download any stored invoice
// as a PDF. The template in invoicePdf.ts is intentionally general — it will
// be customized later.

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { downloadInvoicePdf } from "@/lib/utils/invoicePdf";
import {
  addInvoice,
  CURRENCIES,
  currencySymbol,
  deleteInvoice,
  formatAmount,
  invoiceTotal,
  nextInvoiceNumber,
  subscribeToInvoices,
  updateInvoice,
  subscribeToAllotments,
  updateAllotment,
  type Invoice,
  type InvoiceItem,
  type Allotment,
} from "@/lib/data/finance";

const uuid = () => crypto.randomUUID();

function emptyItem(): InvoiceItem {
  return { id: uuid(), category: "", description: "", qty: 1, unitPrice: 0 };
}

function ZiriumDetails() {
  return (
    <Box sx={{ p: 2, bgcolor: "surface", borderRadius: 2, mb: 3 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        From:
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>ZIRIUM AI SMC PVT LTD</Typography>
      <Typography variant="body2" color="text.secondary">
        Office E-29, 3rd Floor, GS Towers,<br />
        Ring Road, Adjacent Hayatabad Toll Plaza,<br />
        Peshawar, Pakistan — 25000<br />
        NTN: I979681-4
      </Typography>
    </Box>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Invoice | null>(null);

  // Builder state.
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [paymentMethod, setPaymentMethod] = useState<"ubl" | "wise">("ubl");
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Update Received state.
  const [updateReceivedFor, setUpdateReceivedFor] = useState<Invoice | null>(null);
  const [actualReceived, setActualReceived] = useState("");
  const [actualReceivedNote, setActualReceivedNote] = useState("");

  useEffect(() => {
    return subscribeToAllotments((a) => setAllotments(a));
  }, []);

  useEffect(() => {
    return subscribeToInvoices(
      (inv) => {
        setInvoices(inv);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  const total = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.unitPrice, 0),
    [items],
  );

  function patchItem(id: string, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function save() {
    if (!clientName.trim()) {
      setError("A client name is required.");
      return;
    }
    const realItems = items.filter(
      (it) => it.description.trim() || it.category.trim() || it.unitPrice > 0,
    );
    if (realItems.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalItems = realItems;
      if (linkedInvoice) {
        // Add pending balance as a line item if linked invoice has a pending balance
        const pending = invoiceTotal(linkedInvoice) - (linkedInvoice.actualReceived ?? 0);
        if (pending > 0) {
          finalItems = [
            ...realItems,
            {
              id: uuid(),
              category: "Pending Balance",
              description: `From Invoice ${linkedInvoice.number}`,
              qty: 1,
              unitPrice: pending,
            },
          ];
        }
      }

      await addInvoice({
        number: nextInvoiceNumber(invoices.length),
        clientName: clientName.trim(),
        clientCompany: clientCompany.trim(),
        clientAddress: clientAddress.trim(),
        currency,
        items: finalItems,
        notes: notes.trim(),
        paymentMethod,
        actualReceived: null,
        actualReceivedNote: null,
        exchangeRateToPkr: null,
        linkedInvoiceId: linkedInvoice?.id || null,
        linkedInvoiceNumber: linkedInvoice?.number || null,
      });
      setClientName("");
      setClientCompany("");
      setClientAddress("");
      setItems([emptyItem()]);
      setNotes("");
      setLinkedInvoice(null);
      setToast("Invoice saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateReceived() {
    if (!updateReceivedFor) return;
    const n = Number(actualReceived);
    if (isNaN(n) || n < 0) return;

    try {
      await updateInvoice(updateReceivedFor.id, { 
        actualReceived: n,
        actualReceivedNote: actualReceivedNote.trim() || null,
      });
      
      // Auto-adjust linked allotment if one exists
      const linkedAllotment = allotments.find(a => a.invoiceId === updateReceivedFor.id);
      if (linkedAllotment && updateReceivedFor.exchangeRateToPkr) {
        await updateAllotment(linkedAllotment.id, {
          amount: n * updateReceivedFor.exchangeRateToPkr,
        });
      }

      setUpdateReceivedFor(null);
      setActualReceived("");
      setActualReceivedNote("");
      setToast("Actual received updated");
    } catch (err) {
      setError("Failed to update actual received amount");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteInvoice(toDelete.id);
    setToDelete(null);
    setToast("Invoice deleted");
  }

  const symbol = currencySymbol(currency);

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 4 }}>
      {/* Builder */}
      <ZiriumDetails />
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
          Create an invoice
        </Typography>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              label="Client name *"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
              label="Company (optional)"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              value={currency}
              onChange={(e) => {
                const c = e.target.value;
                setCurrency(c);
                setPaymentMethod(c === "USD" ? "wise" : "ubl");
              }}
              label="Currency"
              fullWidth
            >
              {CURRENCIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "ubl" | "wise")}
              label="Payment Method"
              fullWidth
            >
              <MenuItem value="ubl">UBL</MenuItem>
              <MenuItem value="wise">Wise (Ehsan)</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Autocomplete
              options={invoices}
              getOptionLabel={(o) => o.number}
              value={linkedInvoice}
              onChange={(_, v) => setLinkedInvoice(v)}
              renderOption={(props, option) => {
                const pending = invoiceTotal(option) - (option.actualReceived ?? 0);
                return (
                  <li {...props} key={option.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Typography variant="body2">{option.number}</Typography>
                      {pending > 0 && (
                        <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                          {currencySymbol(option.currency)} {formatAmount(pending)}
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Link previous invoice (pending bal)" />
              )}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              label="Client address (optional)"
              multiline
              minRows={2}
              fullWidth
            />
          </Grid>
        </Grid>

        {/* Line items */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, mb: 1, display: "block", fontWeight: 500 }}>
          Line items
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {items.map((it) => (
            <Grid container spacing={1} key={it.id} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 6, sm: 2.5 }}>
                <TextField
                  value={it.category}
                  onChange={(e) => patchItem(it.id, { category: e.target.value })}
                  placeholder="Category"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField
                  value={it.description}
                  onChange={(e) => patchItem(it.id, { description: e.target.value })}
                  placeholder="Description"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 4, sm: 1.5 }}>
                <TextField
                  value={it.qty}
                  onChange={(e) =>
                    patchItem(it.id, { qty: Math.max(0, Number(e.target.value) || 0) })
                  }
                  placeholder="Quantity"
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <TextField
                  value={it.unitPrice}
                  onChange={(e) =>
                    patchItem(it.id, {
                      unitPrice: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  placeholder="Price per Unit"
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 3, sm: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {symbol} {formatAmount(it.qty * it.unitPrice)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 1, sm: 0.5 }}>
                <IconButton
                  size="small"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                >
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Grid>
            </Grid>
          ))}
        </Box>

        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Button
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            variant="outlined"
            color="inherit"
            sx={{ borderStyle: "dashed", borderColor: "divider", color: "text.secondary", fontSize: 12 }}
          >
            Add item
          </Button>
          <Typography variant="subtitle2">
            Total: {symbol} {formatAmount(total)}
          </Typography>
        </Box>

        <TextField
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          label="Notes (payment terms, bank details…)"
          multiline
          minRows={2}
          fullWidth
          sx={{ mt: 2 }}
        />

        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={save} disabled={saving} variant="contained" sx={{ px: 3 }}>
            {saving ? "Saving…" : "Save invoice"}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Stored invoices */}
      <Typography variant="subtitle2" sx={{ mt: 4, mb: 1.5 }}>
        Saved invoices ({invoices.length})
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
        <Table sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "surface" }}>
              <TableCell>Invoice</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Received</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <CircularProgress size={18} />
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No invoices yet. Create your first one above.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{inv.number}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{inv.clientName}</Typography>
                    {inv.clientCompany && (
                      <Typography variant="caption" color="text.secondary">
                        {inv.clientCompany}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                    {inv.createdAt
                      ? inv.createdAt.toDate().toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {currencySymbol(inv.currency)} {formatAmount(invoiceTotal(inv))}
                  </TableCell>
                  <TableCell align="right">
                    {inv.actualReceived !== null ? (
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {currencySymbol(inv.currency)} {formatAmount(inv.actualReceived)}
                        </Typography>
                        {inv.actualReceivedNote && (
                          <Tooltip title={inv.actualReceivedNote} arrow placement="top">
                            <InfoIcon sx={{ fontSize: 18, color: "text.secondary", cursor: "pointer" }} />
                          </Tooltip>
                        )}
                      </Box>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => {
                          setUpdateReceivedFor(inv);
                          setActualReceived(String(invoiceTotal(inv)));
                          setActualReceivedNote(inv.actualReceivedNote || "");
                        }}
                        sx={{ fontSize: 11 }}
                      >
                        Update
                      </Button>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      onClick={() => downloadInvoicePdf(inv)}
                      startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                      size="small"
                      sx={{ fontSize: 12 }}
                    >
                      PDF
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => setToDelete(inv)}
                      sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
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

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete invoice"
        message={`Delete invoice ${toDelete?.number}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      
      <Dialog open={Boolean(updateReceivedFor)} onClose={() => setUpdateReceivedFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Actual Received</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Invoice {updateReceivedFor?.number} total is {updateReceivedFor && currencySymbol(updateReceivedFor.currency)} {updateReceivedFor && formatAmount(invoiceTotal(updateReceivedFor))}.
            <br />
            Enter the actual amount received after any deductions.
          </Typography>
          <TextField
            autoFocus
            label="Actual Received"
            type="number"
            fullWidth
            value={actualReceived}
            onChange={(e) => setActualReceived(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Note (optional)"
            fullWidth
            multiline
            rows={2}
            value={actualReceivedNote}
            onChange={(e) => setActualReceivedNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            helperText={`${actualReceivedNote.length}/300`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateReceivedFor(null)}>Cancel</Button>
          <Button onClick={handleUpdateReceived} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </Box>
  );
}
