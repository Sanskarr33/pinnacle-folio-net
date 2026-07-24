// Live mutual-fund NAV feed.
//
// Fetches AMFI's daily NAVAll dump server-side (no browser CORS, and Netlify's
// runtime has open internet) and returns a compact { ISIN -> NAV } map plus the
// feed's own date. The client overlays these onto holdings by ISIN.
//
// AMFI format is ';'-delimited:
//   Scheme Code;ISIN Div Payout/Growth;ISIN Div Reinvestment;Scheme Name;NAV;Date
// Header lines, scheme-house headings and blank lines have fewer/other fields and
// are skipped by the field-count and "starts with IN" checks.

// AMFI moved the feed to portal.amfiindia.com; the old www host now 302-redirects
// here. Node's fetch follows redirects, but pointing straight at the portal saves a hop.
const AMFI_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

export const handler = async () => {
  try {
    const res = await fetch(AMFI_URL, { headers: { Accept: "text/plain" } });
    if (!res.ok) {
      return json(502, { error: `AMFI feed returned ${res.status}` });
    }
    const text = await res.text();

    const byIsin = {};
    let asOf = "";
    let schemes = 0;

    for (const line of text.split(/\r?\n/)) {
      const p = line.split(";");
      if (p.length < 6) continue;
      const isinGrowth = p[1].trim();
      const isinReinvest = p[2].trim();
      const nav = parseFloat(p[4]);
      const date = p[5].trim();
      if (!(nav > 0)) continue;
      if (isinGrowth.startsWith("IN")) byIsin[isinGrowth] = nav;
      if (isinReinvest.startsWith("IN")) byIsin[isinReinvest] = nav;
      if (date) asOf = date;
      schemes++;
    }

    if (schemes === 0) {
      return json(502, { error: "AMFI feed parsed to zero schemes" });
    }

    return json(200, {
      source: "AMFI",
      asOf,
      schemes,
      count: Object.keys(byIsin).length,
      byIsin,
    });
  } catch (err) {
    return json(500, { error: err && err.message ? err.message : String(err) });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // Same-origin in production; permissive so a preview deploy can be tested too.
      "Access-Control-Allow-Origin": "*",
      // NAVs publish once a day — let the CDN cache for an hour.
      "Cache-Control": "public, max-age=3600",
    },
    body: JSON.stringify(body),
  };
}
