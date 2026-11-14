# Deploying

The web app (`apps/web`, static files) and the API (`apps/api`, Node) are deployed separately.
The browser calls the API directly: there is no proxy.

## 1. API (`apps/api`)

Environment variables (see `apps/api/.env.example`):

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL`, `REDIS_URL` | your hosted Postgres / Redis |
| `JWT_SECRET`, `BETTER_AUTH_SECRET` | random, 32+ chars (`openssl rand -base64 48`); the server refuses to start otherwise |
| `WEB_URL` | the web app's origin, e.g. `https://app.example.com` (the only origin allowed by CORS) |
| `BETTER_AUTH_URL` | this API's public origin, e.g. `https://api.example.com` |
| `TRUST_PROXY` | `1` if the host puts a load balancer in front (Render, Railway, Fly, nginx...), otherwise rate limits see one IP for everyone |
| `GOOGLE_CLIENT_ID/SECRET` | optional; redirect URI `https://api.example.com/api/v1/better-auth/callback/google` |
| `TURN_URLS`, `TURN_SECRET` | recommended, see below |

Steps: `pnpm install` -> `pnpm --filter api build` -> `pnpm --filter api db:migrate` -> `pnpm --filter api start`.
The health check URL is `/health`. The API needs a host that keeps WebSockets open (not serverless).

## 2. Web (`apps/web`)

Set `VITE_API_URL=https://api.example.com` in the host's environment variables, then `pnpm --filter web build`
and serve `apps/web/dist`. The build fails on purpose if `VITE_API_URL` is missing.
`VITE_*` values are baked in at build time: change it, rebuild.

Because the app uses client-side routes (`/home`, `/room/abc`), the host must send every unknown path to
`index.html` (Vercel: a rewrite in `vercel.json`; Netlify/Cloudflare Pages: `public/_redirects` containing `/* /index.html 200`).

## 3. Things that bite

- Serve both over **https**: browsers only allow the microphone on https.
- Put the web app and API on the **same site** (e.g. `app.example.com` + `api.example.com`). Email login works
  anywhere, but Google login uses a cookie that browsers block between unrelated domains (e.g. `x.vercel.app` + `y.onrender.com`).
- **Without `TURN_URLS`, some people can never connect.** They appear in the participant list (that comes from the
  signaling WebSocket, which works everywhere) but their link stays on "Connecting…" and then "Can't connect", because
  the peer-to-peer path needs NAT traversal that STUN alone can't do on symmetric / carrier-grade NAT. Set up TURN
  (section 4). The app now says why a link failed (see the browser console, lines starting with `[webrtc]`).

## 4. TURN (needed, not optional, for a public app)

`docker compose --profile turn up -d coturn` on a machine with a public IP (see the comments in `docker-compose.yml`
for the secret, firewall ports and external IP), then on the API set `TURN_URLS=turn:HOST:3478?transport=udp,turn:HOST:3478?transport=tcp`
and the same `TURN_SECRET`. Verify from two different networks (not two devices on one Wi-Fi: those connect directly and
prove nothing): the console should print `[webrtc] ICE setup { turn: true }`, and for a hostile-NAT pair
`connected to ...: relay <-> ... (through TURN)`. Without a relay-using pair you have not tested TURN.
