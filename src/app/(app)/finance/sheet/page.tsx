"use client";

// Finance → Monthly Sheet: the running ledger of monthly expenses (salaries,
// utilities, and any custom type). The balance column is fully live: money
// received on finance projects flows in (green), allotments and expenses flow
// out (red, − sign). If the balance turns positive it goes green and the −
// sign disappears — automatically, because everything derives from the same
// real-time subscriptions.

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import {
  addMonthlyExpense,
  computeBalance,
  currentMonth,
  deleteMonthlyExpense,
  EXPENSE_TYPES,
  subscribeToAllotments,
  subscribeToFinanceProjects,
  subscribeToMonthlyExpenses,
  updateMonthlyExpense,
  type Allotment,
  type FinanceProject,
  type MonthlyExpense,
} from "@/lib/data/finance";

export default function MonthlySheetPage() {
  const [projects, setProjects] = useState<FinanceProject[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MonthlyExpense | null>(null);

  const [month, setMonth] = useLocalStorage("zirium_draft_sheet_month", currentMonth());
  const [type, setType] = useLocalStorage<string>("zirium_draft_sheet_type", "Salaries");
  const [label, setLabel] = useLocalStorage("zirium_draft_sheet_label", "");
  const [amount, setAmount] = useLocalStorage("zirium_draft_sheet_amount", "");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u1 = subscribeToFinanceProjects(setProjects);
    const u2 = subscribeToAllotments(setAllotments);
    const u3 = subscribeToMonthlyExpenses(
      (e) => {
        setExpenses(e);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const balance = useMemo(
    () => computeBalance(projects, allotments, expenses),
    [projects, allotments, expenses],
  );

  // This month's entries in chronological order (subscription is createdAt asc)
  // with a running balance so each row shows the money left after it applied.
  const monthRows = useMemo(() => {
    const monthEntries = expenses.filter((e) => e.month === month);
    const otherMonthsTotal = expenses
      .filter((e) => e.month !== month)
      .reduce((s, e) => s + e.amount, 0);
    // Balance before any of this month's expenses, then subtract entry by
    // entry so each row shows the money left after it applied.
    const startBalance =
      balance.totalReceived + balance.totalAllotted - otherMonthsTotal;
    const rows: { expense: MonthlyExpense; balanceAfter: number }[] = [];
    for (const [i, e] of monthEntries.entries()) {
      const prev = i === 0 ? startBalance : rows[i - 1].balanceAfter;
      rows.push({ expense: e, balanceAfter: prev - e.amount });
    }
    return rows;
  }, [expenses, month, balance]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return monthRows;
    return monthRows.filter((r) => {
      const e = r.expense;
      const dateStr = e.createdAt ? e.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase() : "";
      return (
        e.type.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        String(e.amount).includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [monthRows, searchQuery]);

  const monthTotal = monthRows.reduce((s, r) => s + r.expense.amount, 0);

  async function add() {
    if (!label.trim()) {
      setError("Describe the expense (e.g. \"July salaries\").");
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
      await addMonthlyExpense({
        month,
        type: type.trim() || "Miscellaneous",
        label: label.trim(),
        amount: n,
      });
      setLabel("");
      setAmount("");
      setToast("Expense added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteMonthlyExpense(toDelete.id);
    setToDelete(null);
    setToast("Expense removed");
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: 4, py: 4 }}>
      {/* Live balance strip */}
      <Grid container spacing={1.5}>
        <SummaryCard label="Money in (received)">
          <Money value={balance.totalReceived} balance sx={{ fontSize: "1.25rem" }} />
        </SummaryCard>
        <SummaryCard label="Allotted">
          <Money value={balance.totalAllotted} balance sx={{ fontSize: "1.25rem" }} />
        </SummaryCard>
        <SummaryCard label="Monthly expenses">
          <Money value={balance.totalExpenses} expense sx={{ fontSize: "1.25rem" }} />
        </SummaryCard>
        <SummaryCard label="Available balance">
          <Money value={balance.available} balance sx={{ fontSize: "1.25rem" }} />
        </SummaryCard>
      </Grid>

      {/* Add expense */}
      <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 3 }}>
        <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
          Add a monthly expense
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
          <Grid size={{ xs: 6, sm: 3, lg: 2.5 }}>
            <Autocomplete
              freeSolo
              options={EXPENSE_TYPES}
              value={type}
              onInputChange={(_, v) => setType(v)}
              renderInput={(params) => (
                <TextField {...params} label="Type" placeholder="Salaries, Utilities…" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3.5 }}>
            <TextField
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              label="Details *"
              placeholder="e.g. July salaries — full team"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <TextField
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              label="Amount *"
              type="number"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }} sx={{ display: "flex", alignItems: "center" }}>
            <Button onClick={add} disabled={saving} variant="contained" fullWidth>
              {saving ? "Adding…" : "Add expense"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Month ledger */}
      <Box sx={{ mt: 3, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2">
          {new Date(month + "-01").toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}{" "}
          sheet — {monthRows.length} {monthRows.length === 1 ? "entry" : "entries"}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search this month..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 200, "& .MuiInputBase-root": { height: 32, fontSize: 13 } }}
          />
          <Typography variant="body2" color="text.secondary">
            Month total: <Money value={monthTotal} expense variant="body2" />
          </Typography>
        </Box>
      </Box>

      <ScrollReveal>
        <Paper variant="outlined" sx={{ mt: 1.5, borderRadius: 3, overflowX: "auto" }}>
          <Table sx={{ minWidth: 680 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "surface" }}>
              <TableCell>Type</TableCell>
              <TableCell>Details</TableCell>
              <TableCell>Added</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Available balance</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <CircularProgress size={18} />
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? "No matching expenses found." : "No expenses recorded for this month yet."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map(({ expense: e, balanceAfter }) => (
                <TableRow
                  key={e.id}
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
                  <TableCell sx={{ width: 150 }}>
                    <EditableText
                      value={e.type}
                      bold
                      onCommit={(v) =>
                        v.trim() && updateMonthlyExpense(e.id, { type: v.trim() })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <EditableText
                      value={e.label}
                      onCommit={(v) =>
                        v.trim() && updateMonthlyExpense(e.id, { label: v.trim() })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12, width: 130 }}>
                    {e.createdAt
                      ? e.createdAt.toDate().toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell align="right" sx={{ width: 150 }}>
                    <EditableExpense
                      value={e.amount}
                      onCommit={(v) => updateMonthlyExpense(e.id, { amount: v })}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 170 }}>
                    <Money value={balanceAfter} balance variant="body2" />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 60 }}>
                    <IconButton
                      className="row-actions"
                      size="small"
                      onClick={() => setToDelete(e)}
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

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
        Balance formula: money received on finance projects + all allotments −
        all monthly expenses. Updating any of them (in any tab) refreshes these
        numbers instantly.
      </Typography>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove expense"
        message={`Remove "${toDelete?.label}" (${toDelete?.type})?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      <Toast open={Boolean(toast)} message={toast ?? ""} onClose={() => setToast(null)} />
    </Box>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
      <ScrollReveal>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 1.75, 
            borderRadius: 3, 
            height: "100%",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            "&:hover": {
              transform: "translateY(-4px)",
              boxShadow: "0 8px 16px -8px rgba(0,0,0,0.1)",
              borderColor: "primary.main",
            }
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {label}
          </Typography>
          <Box sx={{ mt: 0.5 }}>{children}</Box>
        </Paper>
      </ScrollReveal>
    </Grid>
  );
}

function EditableText({
  value,
  bold,
  onCommit,
}: {
  value: string;
  bold?: boolean;
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

// Editable amount displayed as a red − expense until clicked.
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
        <Money value={value} expense variant="body2" />
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
