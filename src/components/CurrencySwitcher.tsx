"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCurrency } from "@/lib/contexts/CurrencyContext";

const CURRENCIES = [
  { code: "PKR", label: "Pakistani Rupee (PKR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", label: "Saudi Riyal (SAR)" },
];

export function CurrencySwitcher() {
  const { currencyCode, setCurrency, resetCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currencyCode);
  const [rate, setRate] = useState<number | "">("");

  const handleOpen = () => {
    setSelected(currencyCode);
    setRate("");
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleApply = () => {
    if (selected === "PKR") {
      resetCurrency();
    } else {
      const numRate = Number(rate);
      if (numRate > 0) {
        setCurrency(selected, numRate);
      } else {
        alert("Please enter a valid exchange rate.");
        return;
      }
    }
    handleClose();
  };

  const handleReset = () => {
    resetCurrency();
    handleClose();
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="text"
        size="small"
        sx={{
          color: "text.secondary",
          fontSize: 12,
          justifyContent: "flex-start",
          textTransform: "none",
          px: 2,
          py: 1,
          "&:hover": { color: "primary.main", bgcolor: "transparent" },
        }}
      >
        Display Currency: {currencyCode}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>Change Display Currency</DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Note: Changing the currency will only affect how monetary values are <strong>displayed</strong> (read-only). Original amounts are safely preserved in PKR. Input fields will always require PKR.
          </Typography>

          <TextField
            select
            label="Target Currency"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            fullWidth
            size="small"
          >
            {CURRENCIES.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>

          {selected !== "PKR" && (
            <TextField
              label={`Today's Rate (1 ${selected} = ? PKR)`}
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value ? Number(e.target.value) : "")}
              fullWidth
              size="small"
              placeholder="e.g. 280"
              helperText={`How many PKR is 1 ${selected}?`}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleReset} color="inherit" sx={{ mr: "auto" }}>
            Reset to PKR
          </Button>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleApply} variant="contained" disabled={selected !== "PKR" && (!rate || Number(rate) <= 0)}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
