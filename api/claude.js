// SIDE B: streaming proxy to the Claude API (Vercel Function, Node runtime).
// Every call must carry a valid Spotify token, so your API key can't be used
// by anyone who isn't signed in to your Spotify app.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function spotifyUser(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const me = await fetch('https://api.spotify.com/v1/me', { headers: { authorization: auth } });
  if (!me.ok) return null;
  const user = await me.json();
  const allowed = (process.env.ALLOWED_SPOTIFY_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(user.id)) return false;
  return user;
}

export async function POST(req) {
  const user = await spotifyUser(req);
  if (user === null) return json({ error: 'Spotify session expired, sign in again' }, 401);
  if (user === false) return json({ error: 'This Spotify account is not allowed' }, 403);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set in Vercel' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const payload = {
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: Math.min(Number(body.max_tokens) || 4000, 16000),
    system: String(body.system || ''),
    messages: Array.isArray(body.messages) ? body.messages : [],
    stream: true,
    thinking: { type: 'disabled' },
  };
  const call = (p) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(p),
  });

  let r = await call(payload);
  if (r.status === 400) {
    const t = await r.text();
    if (/thinking/i.test(t)) { delete payload.thinking; r = await call(payload); }
    else return new Response(t, { status: 400, headers: { 'content-type': 'application/json' } });
  }

  if (!r.ok) return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });

  // ?buffer=1: read the whole stream here and return one JSON reply (sturdier on phones)
  if (new URL(req.url).searchParams.get('buffer') === '1') {
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', stop = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
        else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') return json({ error: ev.error?.message || 'Claude stream error' }, 502);
      }
    }
    return json({ text, stop });
  }

  return new Response(r.body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
}
