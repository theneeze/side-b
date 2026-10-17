# SIDE B

**Vinyl:** ten records from your own crate. **Stream:** a 2, 4 or 6-hour Spotify playlist, sequenced, with a .txt download.
Both are picked by genre, era, mood and occasion; every list is editable in Tune.

## Files

| File | Job |
|---|---|
| `index.html` | The app. Your 169 Discogs records are built in as the starting crate |
| `api/claude.js` | Streams the Claude API (up to 5 minutes, so 6-hour playlists don't time out) |
| `api/store.js` | Syncs crate, tags, lists and history across devices via Upstash Redis |
| `manifest.webmanifest`, icons | Home-screen app |

## Set up from your phone

1. **Vercel** → Add New → Project → import `theneeze/side-b` → Deploy. No settings to change.
2. **Vercel → the project → Settings → Environment Variables**
   - `ANTHROPIC_API_KEY`: your key
   - optional `ALLOWED_SPOTIFY_IDS`: your Spotify user ID, so only you can use the AI and sync
   - optional `CLAUDE_MODEL` (default `claude-sonnet-5-5`)
3. **Vercel → the project → Storage** → Create → Upstash for Redis (free) → connect to the project.
   This adds the env vars `store.js` needs.
4. **Vercel → Deployments** → the latest deployment's menu → Redeploy, so steps 2 and 3 take effect.
5. **developer.spotify.com/dashboard** → your app → Settings → Redirect URIs → add
   `https://YOUR-PROJECT.vercel.app/` (with the trailing slash) → Save.
   Uses the SIDE B Spotify app (client ID built in). A different one can be pasted in Tune → Settings.
6. Open the site in Safari → Share → **Add to Home Screen**.

Every push to `main` redeploys automatically.

## First run

Connect Spotify. SIDE B then syncs the crate, tags all 169 records with genre, original year,
mood and occasion (about a minute), fetches sleeves from Spotify in the background, and reads your
saved albums, playlists and top artists (re-read whenever it's older than 3 hours).

## Spotify notes (February 2026 API rules)

Uses `/me/playlists` and `/playlists/{id}/items`, the endpoints that replaced the old ones.
Development-mode apps allow 5 users, and the app owner needs Premium.
If saving a playlist fails, use .txt or Copy and paste the list into TuneMyMusic.
