// SIDE B: keeps your crate, tags, lists and history in Upstash Redis,
// so phone and laptop see the same collection.
// Connect it in Vercel → Storage → Upstash (Redis); the env vars are added for you.
// Data is stored per Spotify user and only reachable with a valid Spotify token.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

async function guard(req) {
  if (!REDIS_URL || !REDIS_TOKEN) return { res: json({ error: 'Storage not connected' }, 503) };
  const user = await spotifyUser(req);
  if (user === null) return { res: json({ error: 'Spotify session expired' }, 401) };
  if (user === false) return { res: json({ error: 'Not allowed' }, 403) };
  return { key: `side-b:user:${user.id}` };
}

export async function GET(req) {
  const g = await guard(req); if (g.res) return g.res;
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(g.key)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
  if (!r.ok) return json({ error: 'Storage read failed' }, 502);
  const { result } = await r.json();
  return json(result ? JSON.parse(result) : null);
}

export async function PUT(req) {
  const g = await guard(req); if (g.res) return g.res;
  let data;
  try { data = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!data || !Array.isArray(data.collection)) return json({ error: 'Bad payload' }, 400);
  const r = await fetch(`${REDIS_URL}/set/${encodeURIComponent(g.key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) return json({ error: 'Storage write failed' }, 502);
  return json({ ok: true, updatedAt: data.updatedAt });
}
