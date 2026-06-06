// Dummy data for SG Family Wealth dashboard
export const familyKpis = {
  totalAUM: 30000000000, // ₹300 Cr in rupees
  dayChange: 42500000,
  dayChangePct: 0.142,
  unrealisedGain: 4820000000,
  unrealisedGainPct: 19.12,
  realisedGain: 318000000,
  realisedGainPct: 6.4,
  xirr: 17.8,
  invested: 25180000000,
};

export const assetAllocation = [
  { name: "Equity", value: 60.54, amount: 18162000000 },
  { name: "Debt", value: 22.30, amount: 6690000000 },
  { name: "International", value: 7.90, amount: 2370000000 },
  { name: "Gold/Bullion", value: 6.80, amount: 2040000000 },
  { name: "Cash", value: 2.46, amount: 738000000 },
];

export const productExposure = [
  { product: "Direct Equity", value: 9800000000, pct: 32.7 },
  { product: "Mutual Funds", value: 6420000000, pct: 21.4 },
  { product: "PMS", value: 4180000000, pct: 13.9 },
  { product: "AIF", value: 2980000000, pct: 9.9 },
  { product: "Bonds", value: 2240000000, pct: 7.5 },
  { product: "ETF", value: 1820000000, pct: 6.1 },
  { product: "International", value: 1480000000, pct: 4.9 },
  { product: "ULIP", value: 342000000, pct: 1.1 },
  { product: "Cash & FD", value: 738000000, pct: 2.5 },
];

export const entityAllocation = [
  { entity: "Suresh Gupta (Ind)", value: 11200000000 },
  { entity: "Anjali Gupta (Ind)", value: 6300000000 },
  { entity: "SG Family HUF", value: 4800000000 },
  { entity: "Rohan Gupta (Ind)", value: 2900000000 },
  { entity: "Priya Gupta (Ind)", value: 2400000000 },
  { entity: "SG Holdings Pvt Ltd", value: 1700000000 },
  { entity: "SG Family Trust", value: 700000000 },
];

export const wealthOverTime = [
  { month: "Jun '24", value: 24800 },
  { month: "Jul '24", value: 25420 },
  { month: "Aug '24", value: 25180 },
  { month: "Sep '24", value: 26100 },
  { month: "Oct '24", value: 26780 },
  { month: "Nov '24", value: 27240 },
  { month: "Dec '24", value: 27890 },
  { month: "Jan '25", value: 28100 },
  { month: "Feb '25", value: 27620 },
  { month: "Mar '25", value: 28480 },
  { month: "Apr '25", value: 29250 },
  { month: "May '25", value: 30000 },
];

export const advisorAUM = [
  { advisor: "Kotak PWM", aum: 9800, returns: 18.4 },
  { advisor: "ASK Wealth", aum: 6420, returns: 16.2 },
  { advisor: "IIFL Private", aum: 5180, returns: 19.8 },
  { advisor: "Avendus", aum: 3980, returns: 14.7 },
  { advisor: "Motilal Oswal", aum: 2240, returns: 21.1 },
  { advisor: "Self-managed", aum: 2380, returns: 22.6 },
];

export const topHoldings = [
  { name: "HDFC Bank", type: "Equity", entity: "Suresh G.", qty: 48500, ltp: 1742, value: 84.49, gainPct: 24.2 },
  { name: "Reliance Industries", type: "Equity", entity: "SG HUF", qty: 32100, ltp: 2980, value: 95.66, gainPct: 18.7 },
  { name: "Infosys", type: "Equity", entity: "Anjali G.", qty: 28400, ltp: 1865, value: 52.97, gainPct: 15.3 },
  { name: "ICICI Pru Bluechip", type: "MF", entity: "SG Family", qty: 1240000, ltp: 92.4, value: 114.58, gainPct: 21.8 },
  { name: "Marcellus CCP", type: "PMS", entity: "Suresh G.", qty: 1, ltp: 0, value: 88.20, gainPct: 14.6 },
  { name: "ASK IEP", type: "PMS", entity: "Anjali G.", qty: 1, ltp: 0, value: 72.40, gainPct: 12.9 },
  { name: "TCS", type: "Equity", entity: "Suresh G.", qty: 12800, ltp: 4120, value: 52.74, gainPct: 9.4 },
  { name: "Bajaj Finance", type: "Equity", entity: "Rohan G.", qty: 8200, ltp: 7340, value: 60.19, gainPct: -3.2 },
  { name: "Nippon Gold BeES", type: "ETF", entity: "SG HUF", qty: 920000, ltp: 64.8, value: 59.61, gainPct: 28.4 },
  { name: "Edelweiss Cross Border", type: "AIF", entity: "SG Holdings", qty: 1, ltp: 0, value: 48.30, gainPct: 11.2 },
];

export const topMovers = {
  gainers: [
    { name: "Bharti Airtel", change: 4.82, value: 18.4 },
    { name: "L&T", change: 3.91, value: 22.1 },
    { name: "Sun Pharma", change: 3.42, value: 14.6 },
    { name: "Asian Paints", change: 2.98, value: 9.8 },
  ],
  losers: [
    { name: "Bajaj Finance", change: -2.84, value: 60.2 },
    { name: "HDFC Life", change: -2.12, value: 8.4 },
    { name: "Maruti Suzuki", change: -1.74, value: 11.9 },
    { name: "Nestle India", change: -1.21, value: 7.2 },
  ],
};

export const recentTransactions = [
  { date: "2026-06-05", entity: "Suresh Gupta", instrument: "HDFC Bank", type: "BUY", qty: 2500, amount: 4355000 },
  { date: "2026-06-04", entity: "SG HUF", instrument: "ICICI Pru Bluechip", type: "SIP", qty: 5400, amount: 500000 },
  { date: "2026-06-04", entity: "Anjali Gupta", instrument: "ASK IEP PMS", type: "TOP-UP", qty: 0, amount: 25000000 },
  { date: "2026-06-03", entity: "Rohan Gupta", instrument: "Bajaj Finance", type: "SELL", qty: 1200, amount: 8808000 },
  { date: "2026-06-03", entity: "SG Holdings", instrument: "8.15% NHAI Bond", type: "BUY", qty: 100, amount: 10000000 },
  { date: "2026-06-02", entity: "Suresh Gupta", instrument: "Nippon Gold BeES", type: "BUY", qty: 80000, amount: 5184000 },
];

export const riskAlerts = [
  { severity: "high", title: "Single-stock concentration", detail: "Reliance + HDFC Bank = 18.1% of equity book (limit 15%)." },
  { severity: "medium", title: "Exit load window — Marcellus CCP", detail: "₹88.2 Cr — 1.0% exit load expires 22-Aug-2026." },
  { severity: "medium", title: "ULIP underperformance", detail: "HDFC Click2Wealth XIRR 6.4% vs benchmark 11.2% — review." },
  { severity: "low", title: "Cash drag", detail: "₹73.8 Cr in idle savings — deploy to liquid funds." },
];

export const actionItems = [
  { due: "10 Jun", title: "Approve Q1 PMS rebalancing — ASK IEP", owner: "Suresh G." },
  { due: "12 Jun", title: "Sign AIF capital call — Edelweiss Cross Border (₹4.2 Cr)", owner: "SG Holdings" },
  { due: "15 Jun", title: "Renew 3 FDs maturing at HDFC (₹6.8 Cr)", owner: "Anjali G." },
  { due: "18 Jun", title: "Advance tax — Q1 instalment for all entities", owner: "CA Mehta" },
  { due: "22 Jun", title: "Family Investment Committee — quarterly review", owner: "All principals" },
];

export const riskHeatmap = [
  { sector: "Financials", equity: 0.82, debt: 0.34, intl: 0.12 },
  { sector: "Technology", equity: 0.71, debt: 0.08, intl: 0.64 },
  { sector: "Energy", equity: 0.58, debt: 0.18, intl: 0.22 },
  { sector: "Consumer", equity: 0.46, debt: 0.12, intl: 0.31 },
  { sector: "Healthcare", equity: 0.38, debt: 0.06, intl: 0.28 },
  { sector: "Industrials", equity: 0.52, debt: 0.22, intl: 0.18 },
  { sector: "Real Estate", equity: 0.24, debt: 0.41, intl: 0.08 },
];

// Currency formatter — Indian crore style
export function inr(amount: number, opts?: { compact?: boolean }) {
  const cr = amount / 10000000;
  if (opts?.compact) {
    if (cr >= 100) return `₹${cr.toFixed(0)} Cr`;
    return `₹${cr.toFixed(2)} Cr`;
  }
  return `₹${cr.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
}

export function pct(n: number, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}
