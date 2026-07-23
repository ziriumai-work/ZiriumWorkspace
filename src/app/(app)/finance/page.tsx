"use client";

// Finance dashboard: live totals across the finance projects, with a filter
// to look at everything, only ongoing, or only completed work. All numbers
// come from real-time subscriptions, so edits made in any other finance
// section appear here instantly.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Money } from "@/components/finance/Money";
import { chipSx } from "@/components/projectMeta";
import { green, amber, blue } from "@/lib/theme/colors";
import {
  computeBalance,
  pendingOf,
  subscribeToAllotments,
  subscribeToFinanceProjects,
  subscribeToMonthlyExpenses,
  type Allotment,
  type FinanceProject,
  type MonthlyExpense,
} from "@/lib/data/finance";

type Filter = "all" | "ongoing" | "completed";

export default function FinanceDashboardPage() {
  const [projects, setProjects] = useState<FinanceProject[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [unifiedCurrency, setUnifiedCurrency] = useState<string>("PKR");
  const [exchangeRates, setExchangeRates] = useState<Record<string, string>>({});

  useEffect(() => {
    const u1 = subscribeToFinanceProjects((p) => {
      setProjects(p);
      setLoading(false);
    });
    const u2 = subscribeToAllotments(setAllotments);
    const u3 = subscribeToMonthlyExpenses(setExpenses);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const filtered = useMemo(
    () =>
      filter === "all" ? projects : projects.filter((p) => p.status === filter),
    [projects, filter],
  );

  const byCurrency = useMemo(() => {
    const map = new Map<string, { projects: FinanceProject[]; worth: number; received: number; pending: number }>();
    for (const p of filtered) {
      const c = p.currency;
      if (!map.has(c)) {
        map.set(c, { projects: [], worth: 0, received: 0, pending: 0 });
      }
      const data = map.get(c)!;
      data.projects.push(p);
      data.worth += p.worth;
      data.received += p.received;
      data.pending += pendingOf(p);
    }
    return map;
  }, [filtered]);

  const remainingCurrencies = Array.from(byCurrency.keys()).filter((c) => c !== unifiedCurrency);

  const unifiedTotals = useMemo(() => {
    let worth = 0;
    let received = 0;
    for (const p of filtered) {
      let multiplier = 1;
      if (p.currency !== unifiedCurrency) {
        multiplier = Number(exchangeRates[p.currency]) || 0;
      }
      worth += p.worth * multiplier;
      received += p.received * multiplier;
    }
    return { worth, received, pending: worth - received };
  }, [filtered, unifiedCurrency, exchangeRates]);

  const balance = useMemo(
    () => computeBalance(projects, allotments, expenses),
    [projects, allotments, expenses],
  );

  const ongoingCount = projects.filter((p) => p.status === "ongoing").length;
  const completedCount = projects.length - ongoingCount;

  if (loading) {
    return (
      <Box sx={{ px: 4, py: 5 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: 4, py: 4 }}>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {filter === "all"
            ? `${projects.length} projects — ${ongoingCount} ongoing, ${completedCount} completed.`
            : filter === "ongoing"
              ? `${filtered.length} ongoing ${filtered.length === 1 ? "project" : "projects"}.`
              : `${filtered.length} completed ${filtered.length === 1 ? "project" : "projects"}.`}
        </Typography>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v: Filter | null) => v && setFilter(v)}
          size="small"
          sx={{ "& .MuiToggleButton-root": { px: 1.5, py: 0.5, fontSize: 12, textTransform: "none" } }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="ongoing">Ongoing only</ToggleButton>
          <ToggleButton value="completed">Completed only</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="split">Currency Split</ToggleButton>
          <ToggleButton value="unified">Unified</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === "unified" && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: "surface" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Target Currency:</Typography>
              <Select
                size="small"
                value={unifiedCurrency}
                onChange={(e) => setUnifiedCurrency(e.target.value)}
                sx={{ minWidth: 100, bgcolor: "background.paper" }}
              >
                <MenuItem value="PKR">PKR</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="GBP">GBP</MenuItem>
                <MenuItem value="AED">AED</MenuItem>
                <MenuItem value="SAR">SAR</MenuItem>
              </Select>
            </Box>
            
            {remainingCurrencies.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", ml: "auto" }}>
                <Typography variant="body2" color="text.secondary">Exchange Rates:</Typography>
                {remainingCurrencies.map((c) => (
                  <TextField
                    key={c}
                    label={`${c} to ${unifiedCurrency}`}
                    size="small"
                    type="number"
                    value={exchangeRates[c] || ""}
                    onChange={(e) => setExchangeRates(prev => ({ ...prev, [c]: e.target.value }))}
                    sx={{ width: 140, bgcolor: "background.paper" }}
                  />
                ))}
                <Button size="small" variant="outlined" onClick={() => setExchangeRates({})}>Reset</Button>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Headline stats */}
      {viewMode === "unified" ? (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Unified Totals (converted to {unifiedCurrency})</Typography>
          <Grid container spacing={1.5}>
            <StatCard label="Projects" color={blue[500]}>
              <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {filtered.length}
              </Typography>
            </StatCard>
            <StatCard label={`Total worth (${unifiedCurrency})`} color={blue[600]}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {unifiedCurrency} {unifiedTotals.worth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Typography>
            </StatCard>
            <StatCard label={`Received (${unifiedCurrency})`} color={green.main}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "success.main" }}>
                {unifiedCurrency} {unifiedTotals.received.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Typography>
            </StatCard>
            <StatCard label={`Pending (${unifiedCurrency})`} color={amber.main}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: unifiedTotals.pending > 0 ? "warning.main" : "success.main" }}>
                {unifiedCurrency} {unifiedTotals.pending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Typography>
            </StatCard>
          </Grid>
        </Box>
      ) : (
        Array.from(byCurrency.entries()).map(([curr, data]) => (
          <Box key={curr} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{curr} Projects</Typography>
            <Grid container spacing={1.5}>
              <StatCard label="Projects" color={blue[500]}>
                <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {data.projects.length}
                </Typography>
              </StatCard>
              <StatCard label={`Total worth (${curr})`} color={blue[600]}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {curr} {data.worth.toLocaleString()}
                </Typography>
              </StatCard>
              <StatCard label={`Received (${curr})`} color={green.main}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "success.main" }}>
                  {curr} {data.received.toLocaleString()}
                </Typography>
              </StatCard>
              <StatCard label={`Pending (${curr})`} color={amber.main}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: data.pending > 0 ? "warning.main" : "success.main" }}>
                  {curr} {data.pending.toLocaleString()}
                </Typography>
              </StatCard>
            </Grid>
          </Box>
        ))
      )}

      {/* Company-wide available balance (always across ALL projects/expenses) */}
      <Paper
        variant="outlined"
        sx={{ mt: 3, p: 2, borderRadius: 3, display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Available balance (PKR only based on PKR Projects + Allotments)
          </Typography>
          <Money value={balance.available} balance sx={{ fontSize: "1.6rem" }} />
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", ml: "auto" }}>
          <BreakdownItem label="Money in (received)">
            <Money value={balance.totalReceived} balance variant="body2" />
          </BreakdownItem>
          <BreakdownItem label="Allotted">
            <Money value={balance.totalAllotted} expense variant="body2" />
          </BreakdownItem>
          <BreakdownItem label="Monthly expenses">
            <Money value={balance.totalExpenses} expense variant="body2" />
          </BreakdownItem>
        </Box>
      </Paper>

      {/* Per-project quick view */}
      <Typography variant="subtitle2" sx={{ mt: 4, mb: 1.5 }}>
        {filter === "all" ? "All projects" : filter === "ongoing" ? "Ongoing projects" : "Completed projects"}
      </Typography>
      {filtered.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: "center", borderRadius: 3, borderStyle: "dashed" }}
        >
          <Typography variant="body2" color="text.secondary">
            No projects match this filter yet. Add projects in the Projects tab.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={1.5}>
          {filtered.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {p.name}
                  </Typography>
                  <Chip
                    label={p.status === "ongoing" ? "Ongoing" : "Completed"}
                    sx={[
                      chipSx(p.status === "ongoing" ? amber.main : green.main),
                      { height: 20, fontSize: 11, flexShrink: 0 },
                    ]}
                  />
                </Box>
                <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Row label="Worth">
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {p.currency} {p.worth.toLocaleString()}
                    </Typography>
                  </Row>
                  <Row label="Received">
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", color: "success.main" }}>
                      {p.currency} {p.received.toLocaleString()}
                    </Typography>
                  </Row>
                  <Row label="Pending">
                    <Typography
                      variant="body2"
                      sx={{ fontVariantNumeric: "tabular-nums", color: pendingOf(p) > 0 ? "warning.main" : "success.main" }}
                    >
                      {p.currency} {pendingOf(p).toLocaleString()}
                    </Typography>
                  </Row>
                  <Row label="Milestones">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {p.milestoneCount}
                    </Typography>
                  </Row>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function StatCard({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
      <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 3, height: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
        <Box sx={{ mt: 0.75 }}>{children}</Box>
      </Paper>
    </Grid>
  );
}

function BreakdownItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ textAlign: "right" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 11 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Box>
  );
}
