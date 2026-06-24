/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AMFI_URL   = 'https://www.amfiindia.com/spages/NAVAll.txt'
const YF_BASE    = 'https://query1.finance.yahoo.com/v8/finance/chart'
const BATCH_SIZE = 10  // concurrent Yahoo Finance fetches

interface Row {
  id: string
  security_name: string
  ticker: string | null
  quantity: number | null
  average_cost: number | null   // purchase NAV — used for ratio method when units are missing
  invested_value: number | null
  asset_class: string
}

interface PriceUpdates {
  current_price: number
  current_value?: number
  unrealised_gain?: number
  gain_percent?: number
}

async function fetchYFPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`${YF_BASE}/${ticker}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

async function buildAmfiMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const text = await (await fetch(AMFI_URL)).text()
    for (const line of text.split('\n')) {
      const parts = line.split(';')
      if (parts.length < 6) continue
      const name = parts[3]?.trim()
      const nav  = parseFloat(parts[4])
      if (name && !isNaN(nav) && nav > 0) map.set(name, nav)
    }
  } catch { /* silently skip on network failure */ }
  return map
}

// Matches the first 20 chars of security_name against AMFI scheme names.
// Prefers Direct Plan when multiple schemes share the same prefix.
function lookupAmfi(securityName: string, amfiMap: Map<string, number>): number | null {
  const needle = securityName.trim().toLowerCase().slice(0, 20)
  let directHit: number | null = null
  let anyHit: number | null = null
  for (const [name, nav] of amfiMap) {
    if (name.toLowerCase().slice(0, 20) === needle) {
      if (name.toLowerCase().includes('direct')) directHit = nav
      else if (anyHit === null) anyHit = nav
    }
  }
  return directHit ?? anyHit
}

function computeUpdates(price: number, row: Row): PriceUpdates {
  const updates: PriceUpdates = { current_price: price }

  let cv: number | null = null

  if (row.quantity != null) {
    // Normal path: units × current price
    cv = row.quantity * price
  } else if (
    row.average_cost != null && row.average_cost > 0 &&
    row.invested_value != null && row.invested_value > 0
  ) {
    // Ratio method for MF rows where units are not recorded:
    // current_value = invested_value × (current_NAV / purchase_NAV)
    cv = row.invested_value * (price / row.average_cost)
  }

  if (cv != null) {
    updates.current_value = cv
    if (row.invested_value != null && row.invested_value > 0) {
      updates.unrealised_gain = cv - row.invested_value
      updates.gain_percent    = ((cv - row.invested_value) / row.invested_value) * 100
    }
  }

  return updates
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const summary = {
    updated:   0,
    skipped:   0,
    errors:    [] as string[],
    timestamp: new Date().toISOString(),
  }

  // ── 1. Fetch rows from DB ──────────────────────────────────────────────────
  const [{ data: equityRows, error: eqErr }, { data: mfRows, error: mfErr }] =
    await Promise.all([
      supabase
        .from('sg_family_holdings_import')
        .select('id,security_name,ticker,quantity,average_cost,invested_value,asset_class')
        .not('ticker', 'is', null)
        .in('asset_class', ['Direct Equity', 'ETF', 'Gold', 'Silver']),
      supabase
        .from('sg_family_holdings_import')
        .select('id,security_name,quantity,average_cost,invested_value,asset_class')
        .in('asset_class', ['Equity MF', 'Debt MF']),
    ])

  if (eqErr) summary.errors.push(`Row fetch (equity): ${eqErr.message}`)
  if (mfErr)  summary.errors.push(`Row fetch (MF): ${mfErr.message}`)

  // ── 2. Yahoo Finance — fetch unique tickers in parallel batches ───────────
  const uniqueTickers = [
    ...new Set(
      ((equityRows ?? []) as Row[])
        .map((r) => r.ticker)
        .filter((t): t is string => t != null)
    ),
  ]
  const priceMap = new Map<string, number>()

  for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
    const batch  = uniqueTickers.slice(i, i + BATCH_SIZE)
    const prices = await Promise.all(batch.map(fetchYFPrice))
    batch.forEach((t, idx) => {
      if (prices[idx] != null) priceMap.set(t, prices[idx]!)
    })
  }

  // ── 3. AMFI — download and parse NAV file ─────────────────────────────────
  const amfiMap = await buildAmfiMap()

  // ── 4. Collect pending updates ────────────────────────────────────────────
  type Pending = { id: string; updates: PriceUpdates; label: string }
  const pending: Pending[] = []

  for (const row of (equityRows ?? []) as Row[]) {
    const price = priceMap.get(row.ticker!)
    if (!price) {
      summary.skipped++
      summary.errors.push(`No YF price: ${row.ticker}`)
      continue
    }
    pending.push({ id: row.id, updates: computeUpdates(price, row), label: row.ticker! })
  }

  for (const row of (mfRows ?? []) as Row[]) {
    const nav = lookupAmfi(row.security_name, amfiMap)
    if (!nav) {
      summary.skipped++
      continue
    }
    pending.push({ id: row.id, updates: computeUpdates(nav, row), label: row.security_name })
  }

  // ── 5. Batch-update Supabase (20 rows per round) ──────────────────────────
  for (let i = 0; i < pending.length; i += 20) {
    const chunk = pending.slice(i, i + 20)
    const results = await Promise.all(
      chunk.map(({ id, updates }) =>
        supabase.from('sg_family_holdings_import').update(updates).eq('id', id)
      ),
    )
    results.forEach(({ error }: { error: { message: string } | null }, idx: number) => {
      if (error) {
        summary.errors.push(`Update ${chunk[idx].label}: ${error.message}`)
        summary.skipped++
      } else {
        summary.updated++
      }
    })
  }

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
