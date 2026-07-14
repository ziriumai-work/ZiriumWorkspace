"use client";

// Consistent money rendering for the Finance section.
// - `expense` → always red with a leading − sign.
// - `balance` → green when positive (or zero), red with a − sign when negative.
// - default   → plain themed text.

import Typography, { type TypographyProps } from "@mui/material/Typography";
import { formatAmount } from "@/lib/data/finance";
import { useCurrency } from "@/lib/contexts/CurrencyContext";

const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: "Rs",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "ر.س",
};

export function Money({
  value: rawValue,
  currency: explicitCurrency,
  expense = false,
  balance = false,
  ...typographyProps
}: {
  value: number;
  currency?: string;
  expense?: boolean; //  render as money going out (red, − sign)
  balance?: boolean; //  render as a balance (green ≥ 0, red < 0)
} & TypographyProps) {
  const { currencyCode, exchangeRate } = useCurrency();
  
  // If explicitly overridden, don't convert. Otherwise convert.
  const activeCurrency = explicitCurrency || currencyCode;
  const isConverted = !explicitCurrency && currencyCode !== "PKR";
  
  const value = isConverted ? rawValue / exchangeRate : rawValue;
  const symbol = CURRENCY_SYMBOLS[activeCurrency] || activeCurrency;

  let color: string | undefined;
  let text: string;

  if (expense) {
    color = "error.main";
    text = `− ${symbol} ${formatAmount(Math.abs(value))}`;
  } else if (balance) {
    const negative = value < 0;
    color = negative ? "error.main" : "success.main";
    text = negative
      ? `− ${symbol} ${formatAmount(Math.abs(value))}`
      : `${symbol} ${formatAmount(value)}`;
  } else {
    text = `${symbol} ${formatAmount(value)}`;
  }

  return (
    <Typography
      component="span"
      {...typographyProps}
      sx={{
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
        ...(color ? { color } : {}),
        ...((typographyProps.sx as object) ?? {}),
      }}
    >
      {text}
    </Typography>
  );
}
