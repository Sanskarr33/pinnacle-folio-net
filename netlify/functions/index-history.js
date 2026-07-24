// Daily index history for the benchmark page.
//
// A copy of this series ships in src/data/index-history.json so the page works
// offline and in local dev; this function exists to top it up with closes published
// since the last deploy. Fetched server-side because the browser cannot call the
// upstream directly (CORS), same arrangement as the NAV feed.
//
// The upstream is unofficial, so the response is validated before it is returned:
// a short or empty series is reported as an error rather than passed on as "history".

const SYMBOLS = {
  "^NSEI": "NIFTY 50",
  "^BSESN": "BSE Sensex",
};

const RANGE = "10y";

export const handler = async () => {
  try {
    const series = {};
    const failures = [];

    for (const symbol of Object.keys(SYMBOLS)) {
      try {
        const url =
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
          `?range=${RANGE}&interval=1d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        });
        if (!res.ok) {
          failures.push(`${symbol}: HTTP ${res.status}`);
          continue;
        }
        const payload = await res.json();
        const result = payload?.chart?.result?.[0];
        const stamps = result?.timestamp ?? [];
        const closes = result?.indicators?.quote?.[0]?.close ?? [];

        const points = {};
        for (let i = 0; i < stamps.length; i++) {
          const c = closes[i];
          if (c == null || !(c > 0)) continue;
          points[new Date(stamps[i] * 1000).toISOString().slice(0, 10)] = Math.round(c * 1e4) / 1e4;
        }
        // A handful of points is a broken response, not a history.
        if (Object.keys(points).length < 250) {
          failures.push(`${symbol}: only ${Object.keys(points).length} points`);
          continue;
        }
        series[symbol] = points;
      } catch (e) {
        failures.push(`${symbol}: ${e && e.message ? e.message : String(e)}`);
      }
    }

    if (Object.keys(series).length === 0) {
      return json(502, { error: `No index series available. ${failures.join("; ")}` });
    }

    return json(200, {
      series,
      names: SYMBOLS,
      fetchedAt: new Date().toISOString(),
      ...(failures.length ? { partial: failures } : {}),
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
      "Access-Control-Allow-Origin": "*",
      // Closes publish once a day.
      "Cache-Control": "public, max-age=3600",
    },
    body: JSON.stringify(body),
  };
}
