// @ts-nocheck — Deno runtime; URL imports and Deno globals are not valid Node/TS
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AMFI_URL   = 'https://www.amfiindia.com/spages/NAVAll.txt'
const YF_BASE    = 'https://query1.finance.yahoo.com/v8/finance/chart'
const BATCH_SIZE = 10

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// ---- Abbreviation expansion -----------------------------------------------
function expandAbbr(s: string): string {
  return s
    .replace(/\bpru\b/gi,     'prudential')
    .replace(/\bopp\b/gi,     'opportunities')
    .replace(/\bfin\b/gi,     'financial')
    .replace(/\bserv\b/gi,    'services')
    .replace(/\btech\b/gi,    'technology')
    .replace(/\beq\b/gi,      'equity')
    .replace(/flexicap/gi,    'flexi cap')
    .replace(/largecap/gi,    'large cap')
    .replace(/midcap/gi,      'mid cap')
    .replace(/smallcap/gi,    'small cap')
    .replace(/multicap/gi,    'multi cap')
    .replace(/bluechip/gi,    'blue chip')
}

// ---- Noise removal --------------------------------------------------------
const NOISE_WORDS = [
  'mutual funds', 'mutual fund', 'funds', 'fund',
  'direct plan', 'regular plan', 'direct', 'regular',
  'growth option', 'growth', 'idcw',
  'dividend reinvestment', 'dividend payout', 'dividend',
  'reinvestment', 'payout', 'option', 'scheme', 'series',
  'dir', 'fof',
  'ltd', 'limited', 'india', 'indian', 'the', 'and', 'an', 'of', 'a',
]
const NOISE_RE = new RegExp(
  '\\b(' +
    NOISE_WORDS
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
  ')\\b',
  'g'
)

function normName(s: string): string {
  return expandAbbr(s)
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(NOISE_RE, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/ +/g, ' ')
    .trim()
}

// ---- Types ----------------------------------------------------------------
interface AmfiEntry { nav: number; isDirect: boolean; words: string[] }

interface Row {
  id: string
  security_name: string
  ticker: string | null
  quantity: number | null
  average_cost: number | null
  invested_value: number | null
  asset_class: string
}

interface PriceUpdates {
  current_price: number
  current_value?: number
  unrealised_gain?: number
  gain_percent?: number
}

// ---- Yahoo Finance --------------------------------------------------------
async function fetchYFPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`${YF_BASE}/${ticker}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch { return null }
}

// ---- AMFI: one-pass build of inverted word index --------------------------
async function buildAmfi(): Promise<{
  wordIdx: Map<string, number[]>
  entries: AmfiEntry[]
}> {
  const entries: AmfiEntry[] = []
  const wordIdx  = new Map<string, number[]>()

  try {
    const text = await (await fetch(AMFI_URL)).text()
    for (const line of text.split('\n')) {
      const parts = line.split(';')
      if (parts.length < 6) continue
      const name = parts[3]?.trim()
      const nav  = parseFloat(parts[4])
      if (!name || isNaN(nav) || nav <= 0) continue

      const isDirect = name.toLowerCase().includes('direct')
      const wordSet  = new Set(
        normName(name).split(' ').filter(w => w.length > 2)
      )
      const idx = entries.length
      entries.push({ nav, isDirect, words: [...wordSet] })

      for (const w of wordSet) {
        let arr = wordIdx.get(w)
        if (!arr) { arr = []; wordIdx.set(w, arr) }
        arr.push(idx)
      }
    }
  } catch { /* skip on network failure */ }

  return { wordIdx, entries }
}

// ---- AMFI lookup ----------------------------------------------------------
// v7: per-candidate sanity check (inherited from v6) + no closeness tiebreak.
// The closeness tiebreak in v6 caused systematic regressions by picking IDCW
// plan variants (lower NAV, "closer" to purchase price) over Growth plan
// variants for well-performing funds. Removed in v7.
// For the Growth vs IDCW disambiguation, DB names are engineered to include
// the word "plan" which only appears in Growth option normNames.
function amfiLookup(
  securityName: string,
  wordIdx: Map<string, number[]>,
  entries: AmfiEntry[],
  purchaseNav: number | null
): number | null {
  const needleWords = [
    ...new Set(normName(securityName).split(' ').filter(w => w.length > 2))
  ]
  if (needleWords.length === 0) return null

  const hitCount = new Map<number, number>()
  for (const w of needleWords) {
    for (const idx of wordIdx.get(w) ?? []) {
      hitCount.set(idx, (hitCount.get(idx) ?? 0) + 1)
    }
  }

  let bestDirectScore = 0; let bestDirectNav: number | null = null
  let bestAnyScore    = 0; let bestAnyNav:    number | null = null

  for (const [idx, hits] of hitCount) {
    const overlapRatio = hits / needleWords.length
    if (overlapRatio < 0.70) continue
    const { nav, isDirect } = entries[idx]

    // Per-candidate sanity: skip candidates whose NAV is >30× or <1/30 of
    // the purchase NAV. Applied here (not post-selection) so a false-positive
    // with an extreme NAV cannot block the correct fund.
    if (purchaseNav !== null && purchaseNav > 0) {
      const r = nav / purchaseNav
      if (r > 30 || r < 0.033) continue
    }

    const score = Math.round(overlapRatio * 100)

    if (isDirect) {
      if (score > bestDirectScore) { bestDirectScore = score; bestDirectNav = nav }
    } else {
      if (score > bestAnyScore) { bestAnyScore = score; bestAnyNav = nav }
    }
  }

  return bestDirectNav ?? bestAnyNav
}

// ---- Value computation ---------------------------------------------------
function computeUpdates(price: number, row: Row): PriceUpdates {
  const updates: PriceUpdates = { current_price: price }
  let cv: number | null = null

  if (row.quantity != null) {
    cv = row.quantity * price
  } else if (
    row.average_cost != null && row.average_cost > 0 &&
    row.invested_value != null && row.invested_value > 0
  ) {
    cv = row.invested_value * (price / row.average_cost)
  }

  if (cv != null) {
    updates.current_value    = cv
    if (row.invested_value != null && row.invested_value > 0) {
      updates.unrealised_gain = cv - row.invested_value
      updates.gain_percent    = ((cv - row.invested_value) / row.invested_value) * 100
    }
  }
  return updates
}

// ---- Main handler --------------------------------------------------------
Deno.serve(async (req: Request) => {
  // Preflight — browsers send OPTIONS before POST cross-origin
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const summary = {
    updated:    0,
    skipped:    0,
    mf_matched: 0,
    mf_missed:  0,
    errors:     [] as string[],
    timestamp:  new Date().toISOString(),
  }

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

  const uniqueTickers = [
    ...new Set(
      ((equityRows ?? []) as Row[])
        .map(r => r.ticker)
        .filter((t): t is string => t != null)
    ),
  ]
  const priceMap = new Map<string, number>()
  for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
    const batch  = uniqueTickers.slice(i, i + BATCH_SIZE)
    const prices = await Promise.all(batch.map(fetchYFPrice))
    batch.forEach((t, j) => { if (prices[j] != null) priceMap.set(t, prices[j]!) })
  }

  const { wordIdx, entries: amfiEntries } = await buildAmfi()

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
    const purchaseNav =
      (row.quantity != null && row.quantity > 0 &&
       row.invested_value != null && row.invested_value > 0)
        ? row.invested_value / row.quantity
        : row.average_cost

    const nav = amfiLookup(row.security_name, wordIdx, amfiEntries, purchaseNav)
    if (!nav) {
      summary.skipped++
      summary.mf_missed++
      summary.errors.push(`No AMFI NAV: ${row.security_name}`)
      continue
    }
    summary.mf_matched++
    pending.push({ id: row.id, updates: computeUpdates(nav, row), label: row.security_name })
  }

  for (let i = 0; i < pending.length; i += 20) {
    const chunk = pending.slice(i, i + 20)
    const results = await Promise.all(
      chunk.map(({ id, updates }) =>
        supabase.from('sg_family_holdings_import').update(updates).eq('id', id)
      )
    )
    results.forEach(({ error }: { error: { message: string } | null }, j: number) => {
      if (error) {
        summary.errors.push(`Update ${chunk[j].label}: ${error.message}`)
        summary.skipped++
      } else {
        summary.updated++
      }
    })
  }

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
