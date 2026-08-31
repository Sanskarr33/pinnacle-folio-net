// Development-only integrity checks for portfolio.json.
//
// These DO sum things — deliberately. That is the point of a reconciliation:
// prove the file's own aggregates agree with its own detail. None of these
// results reach the render path; they are console output, gated on import.meta
// .env.DEV, so the shipped bundle never derives a displayed figure.
//
// Run automatically on load in dev; also exposed as window.__reconcilePortfolio()
// so it can be re-run by hand from the console.

import type { PortfolioFile } from "./portfolio-file";

const TOLERANCE = 1; // rupees

export interface CheckResult {
  name: string;
  pass: boolean;
  expected: number;
  actual: number;
  delta: number;
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export function reconcile(file: PortfolioFile, compact = false): CheckResult[] {
  const target = file.totals.currentValue;

  const check = (name: string, actual: number, expected: number, tol = TOLERANCE): CheckResult => {
    const delta = actual - expected;
    return { name, pass: Math.abs(delta) <= tol, expected, actual, delta };
  };

  const results: CheckResult[] = [
    check("categories → totals.currentValue", sum(file.categories.map((r) => r.value)), target),
    check("sleeves → totals.currentValue", sum(file.sleeves.map((r) => r.value)), target),
    check("entities → totals.currentValue", sum(file.entities.map((r) => r.value)), target),
    check(
      "byAssetClass → totals.currentValue",
      sum(file.breakdowns.byAssetClass.map((r) => r.value)),
      target,
    ),
    // Percentages carry two decimals, so rounding across 10 rows can legitimately
    // land a paisa either side of 100. Tolerance is in percentage points here.
    check("categories weightPct → 100.00", sum(file.categories.map((r) => r.weightPct)), 100, 0.05),
    check(
      "byAssetClass counts → totals.counts.instruments",
      sum(file.breakdowns.byAssetClass.map((r) => r.count)),
      file.totals.counts.instruments,
      0,
    ),
    check("categories count", file.categories.length, file.totals.counts.categories, 0),
    check("sleeves count", file.sleeves.length, file.totals.counts.sleeves, 0),
    check("entities count", file.entities.length, file.totals.counts.entities, 0),
  ];

  // A portfolio.summary.json legitimately has no instrument list, so checking it
  // against totals.counts would report a failure that is not one.
  if (!compact) {
    results.push(
      check("holdings → totals.currentValue", sum(file.holdings.map((r) => r.value)), target),
      check(
        "holdings count → totals.counts.instruments",
        file.holdings.length,
        file.totals.counts.instruments,
        0,
      ),
    );
  }

  return results;
}

/** Pretty-print to the console. Returns true when every check passed. */
export function reportReconciliation(file: PortfolioFile, compact = false): boolean {
  const results = reconcile(file, compact);
  const failed = results.filter((r) => !r.pass);
  const label = `portfolio.json reconciliation — ${results.length - failed.length}/${results.length} passed`;

  if (failed.length) {
    console.group(`%c${label}`, "color:#dc2626;font-weight:600");
  } else {
    console.groupCollapsed(`%c${label}`, "color:#16a34a;font-weight:600");
  }
  console.table(
    results.map((r) => ({
      check: r.name,
      expected: r.expected,
      actual: r.actual,
      delta: r.delta,
      result: r.pass ? "PASS" : "FAIL",
    })),
  );
  if (failed.length) {
    console.error(
      "Figures on the page come straight from the file, so these mismatches mean the FILE disagrees with itself — regenerate it rather than patching the dashboard.",
    );
  }
  console.groupEnd();

  return failed.length === 0;
}
