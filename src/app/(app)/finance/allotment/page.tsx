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
import { Money } from "@/components/finance/Money";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  addAllotment,
  currentMonth,
  deleteAllotment,
  subscribeToAllotments,
  subscribeToInvoices,
  updateAllotment,
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

  const [month, setMonth] = useState(currentMonth());
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
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

  async function add() {
    if (!label.trim()) {
      setError("Write where the money goes (a section name).");
      return;
    }
    const n = Number(amount);
    if (!n || n <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addAllotment({
        month,
        label: label.trim(),
        amount: n,
        note: note.trim(),
        invoiceId: linkedInvoice?.id || null,
        invoiceNumber: linkedInvoice?.number || null,
      });
      setLabel("");
      setAmount("");
      setNote("");
      setLinkedInvoice(null);
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
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 4 }}>
      {/* Month selector + add form */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
          Allot money for a month
        </Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <TextField
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              label="Month"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, lg: 3 }}>
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
          <Grid size={{ xs: 6, sm: 4, lg: 3 }}>
            <Autocomplete
              options={invoices}
              getOptionLabel={(o) => `${o.number} — ${o.createdAt ? o.createdAt.toDate().toLocaleDateString() : ""}`}
              value={linkedInvoice}
              onChange={(_, v) => setLinkedInvoice(v)}
              renderInput={(params) => (
                <TextField {...params} label="Link Invoice (Source of funds)" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <TextField
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              label="Amount (PKR) *"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, lg: 3 }}>
            <TextField
              value={note}
              onChange={(e) => setNote(e.target.value)}
              label="Note (optional)"
              fullWidth
            />
          </Grid>
          <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={add} disabled={saving} variant="contained" sx={{ px: 4 }}>
              {saving ? "Adding…" : "Add Allotment"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

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
                    "& .row-actions": { opacity: 0 },
                    "&:hover .row-actions": { opacity: 1 },
                  }}
                >
                  <TableCell sx={{ minWidth: 160 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <EditableText
                        value={a.label}
                        bold
                        onCommit={(v) => v.trim() && updateAllotment(a.id, { label: v.trim() })}
                      />
                      {a.invoiceNumber && (
                        <Chip label={a.invoiceNumber} size="small" sx={{ fontSize: 10, height: 18 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <EditableText
                      value={a.note}
                      placeholder="Add a note…"
                      onCommit={(v) => updateAllotment(a.id, { note: v })}
                    />
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

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove allotment"
        message={`Remove "${toDelete?.label}" from ${toDelete?.month}?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
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
