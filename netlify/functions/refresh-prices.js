// Proxy to Supabase edge function — call is server-side so no browser CORS.
const SUPABASE_URL = 'https://bdjwhgwoztdocwdvzrem.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkandoZ3dvenRkb2N3ZHZ6cmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzM1NzksImV4cCI6MjA5NjIwOTU3OX0.Td8dWDrDRNHh_sFbVpo2mNcbXr3qZEvXbaMU3sUKXis';

export const handler = async () => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/update-prices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({}),
      }
    );
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
