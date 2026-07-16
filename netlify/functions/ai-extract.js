// AI meeting note extraction proxy.
// Requires ANTHROPIC_API_KEY set in Netlify dashboard → Site Settings → Environment Variables.

const SYSTEM_PROMPT = `You are an AI assistant for a family office. Analyze these meeting notes and extract structured information. Return ONLY valid JSON with this exact structure:
{
  "summary": "3-4 sentence summary of the meeting",
  "key_topics": ["topic1", "topic2"],
  "action_items": [
    {
      "action_type": "BUY|SELL|HOLD|REVIEW|REBALANCE|OTHER",
      "description": "Clear description of what needs to be done",
      "security_name": "name of stock/fund if mentioned, else null",
      "asset_class": "Direct Equity|Equity MF|Debt MF|PMS|AIF|Bonds|REIT|ETF|null",
      "entity_name": "SG|SMC|SSI|Veer|SMO|SSG|Suhel|null",
      "target_amount": null,
      "timeline": "Immediate|This Week|This Month|This Quarter|null",
      "priority": "High|Medium|Low"
    }
  ],
  "next_meeting_suggestion": "suggested next meeting topic if any"
}`;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Netlify environment variables' }),
    };
  }

  let notes = '';
  try {
    const body = JSON.parse(event.body || '{}');
    notes = body.notes ?? '';
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!notes.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'notes field is required' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Meeting notes to analyse:\n\n${notes}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: `Anthropic API error: ${response.status} ${err}` }) };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';

    // Extract JSON block (Claude sometimes adds prose around it)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not parse JSON from AI response', raw: text }) };
    }

    const parsed = JSON.parse(match[0]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
    };
  }
};
