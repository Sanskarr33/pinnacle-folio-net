export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { rawNotes, advisorName } = JSON.parse(event.body);

    const systemPrompt = `You are an AI assistant for a family office.
Analyze these meeting notes and extract structured information.
Return ONLY valid JSON with this exact structure, no other text:
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://commandwealthsmc.netlify.app',
        'X-Title': 'SG Family Wealth Command Centre'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Advisor: ${advisorName}\n\nMeeting Notes:\n${rawNotes}` }
        ],
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenRouter API error');
    }

    const content = data.choices[0].message.content;

    // Clean JSON response
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanContent);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
