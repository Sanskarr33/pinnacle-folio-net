// Server function that parses a transaction screenshot/PDF via the Claude API.
// Runs server-only (see .handler body) so the ANTHROPIC_API_KEY never reaches
// the browser bundle. Module-level code here (zod, createServerFn) is safe to
// ship client-side — only the process.env read inside the handler is server-only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const inputSchema = z.object({
  base64: z.string().min(1),
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]),
});

export interface ParsedTransaction {
  transaction_type: "BUY" | "SELL";
  transaction_date: string | null;
  financial_year: string | null;
  asset_class: string | null;
  security_name: string | null;
  entity_name: string | null;
  broker: string | null;
  folio_number: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
  cost_of_acquisition: number | null;
  realised_gain: number | null;
  notes: string | null;
}

const SYSTEM_PROMPT = `You are a financial transaction parser for an Indian family office.
Extract transaction details from this screenshot and return ONLY a JSON array of transactions with these exact fields:
{
  transaction_type: 'BUY' | 'SELL',
  transaction_date: 'YYYY-MM-DD',
  financial_year: '2026-27' | '2025-26',
  asset_class: 'Direct Equity' | 'Equity MF' | 'ETF' | 'REIT' | 'Bonds' | 'Fixed Deposit' | 'PMS' | 'AIF',
  security_name: string,
  entity_name: 'SG' | 'SMC' | 'SSI' | 'Veer' | 'SMO' | 'SSG' | 'Suhel',
  broker: string,
  folio_number: string | null,
  quantity: number | null,
  price: number | null,
  amount: number,
  purchase_date: 'YYYY-MM-DD' | null,
  purchase_price: number | null,
  cost_of_acquisition: number | null,
  realised_gain: number | null,
  notes: string | null
}
Return ONLY the JSON array, no other text.`;

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// Coerces whatever Claude returned into ParsedTransaction[] without throwing
// on individually malformed rows — the user reviews/edits everything before save.
function normalize(raw: unknown): ParsedTransaction[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return raw
    .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
    .map((row) => ({
      transaction_type: row.transaction_type === "SELL" ? "SELL" : "BUY",
      transaction_date: str(row.transaction_date),
      financial_year: str(row.financial_year),
      asset_class: str(row.asset_class),
      security_name: str(row.security_name),
      entity_name: str(row.entity_name),
      broker: str(row.broker),
      folio_number: str(row.folio_number),
      quantity: num(row.quantity),
      price: num(row.price),
      amount: num(row.amount) ?? 0,
      purchase_date: str(row.purchase_date),
      purchase_price: num(row.purchase_price),
      cost_of_acquisition: num(row.cost_of_acquisition),
      realised_gain: num(row.realised_gain),
      notes: str(row.notes),
    }));
}

export const parseTransactionScreenshot = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<ParsedTransaction[]> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured on the server. Add it in Netlify environment variables.",
      );
    }

    const isPdf = data.mediaType === "application/pdf";
    const contentBlock = isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: data.mediaType, data: data.base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: data.mediaType, data: data.base64 },
        };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: "Extract every transaction visible in this screenshot/document and return the JSON array as instructed.",
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API error ${res.status}: ${text.slice(0, 400)}`);
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const textBlock = (json.content ?? []).find((b) => b.type === "text");
    const raw = textBlock?.text ?? "";
    const cleaned = stripCodeFence(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Claude did not return valid JSON — try a clearer screenshot.");
    }

    return normalize(parsed);
  });
