import { createContext, useContext, useState } from "react";

export type CurrencyFormat = "cr" | "lakh" | "million" | "raw";

interface CurrencyContextType {
  format: CurrencyFormat;
  setFormat: (f: CurrencyFormat) => void;
  formatAmount: (amount: number) => string;
  formatLabel: string;
}

const STORAGE_KEY = "sg_currency_format";

function makeFormatter(format: CurrencyFormat): (amount: number) => string {
  switch (format) {
    case "cr":
      return (v) => `₹${(v / 10_000_000).toFixed(2)} Cr`;
    case "lakh":
      return (v) => `₹${(v / 100_000).toFixed(2)} L`;
    case "million":
      return (v) => `₹${(v / 1_000_000).toFixed(2)} M`;
    case "raw":
      return (v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
}

const FORMAT_LABELS: Record<CurrencyFormat, string> = {
  cr: "₹ Cr",
  lakh: "₹ L",
  million: "₹ M",
  raw: "₹",
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [format, setFormatState] = useState<CurrencyFormat>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "cr" || stored === "lakh" || stored === "million" || stored === "raw") {
        return stored;
      }
    } catch {
      // localStorage unavailable (SSR)
    }
    return "cr";
  });

  function setFormat(f: CurrencyFormat) {
    setFormatState(f);
    try { localStorage.setItem(STORAGE_KEY, f); } catch { /* ignore */ }
  }

  return (
    <CurrencyContext.Provider
      value={{
        format,
        setFormat,
        formatAmount: makeFormatter(format),
        formatLabel: FORMAT_LABELS[format],
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
