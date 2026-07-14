"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CurrencyContextValue {
  currencyCode: string;
  exchangeRate: number; // e.g., 1 USD = 280 PKR. Stored as 280.
  setCurrency: (code: string, rate: number) => void;
  resetCurrency: () => void;
  formatCurrency: (amountInPkr: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [exchangeRate, setExchangeRate] = useState(1);

  const setCurrency = (code: string, rate: number) => {
    setCurrencyCode(code);
    setExchangeRate(rate);
  };

  const resetCurrency = () => {
    setCurrencyCode("PKR");
    setExchangeRate(1);
  };

  const formatCurrency = (amountInPkr: number) => {
    if (typeof amountInPkr !== 'number' || isNaN(amountInPkr)) return `${currencyCode === "PKR" ? "Rs " : "$"}0.00`;
    const converted = amountInPkr / exchangeRate;
    const prefix = currencyCode === "PKR" ? "Rs " : currencyCode === "USD" ? "$" : `${currencyCode} `;
    
    return `${prefix}${converted.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currencyCode, exchangeRate, setCurrency, resetCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
