# API

Express 5 + TypeScript + Drizzle ORM (PostgreSQL).

## Setup

```bash
pnpm install              # from the repo root (this is a pnpm workspace; there is no package-lock.json)
cp .env.example .env      # fill in DATABASE_URL and the secrets; Google vars are optional
pnpm db:migrate           # apply migrations in ./drizzle
pnpm dev                  # tsx watch, http://localhost:3000/api/v1/health
```

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Run `src/index.ts` with auto-reload (tsx) |
| `pnpm build` / `npm start` | Compile to `dist/` and run it |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm test` | Integration tests against a real Postgres + Redis (Redis db 15 is flushed) |
| `pnpm db:generate` | Generate a migration after editing `src/db/schema` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema straight to the DB (dev only) |
| `pnpm db:studio` | Open Drizzle Studio |

## Structure

```
src/
  index.ts            # entry: DB check, listen, graceful shutdown
  app.ts              # express app + middleware order
  config/env.ts       # env loading and validation
  db/                 # drizzle client + schema/ (one file per table)
  features/<name>/    # routes.ts -> controllers.ts -> services.ts
  middlewares/        # response, authorization (requireAuth checks the DB on every call), errors
  realtime/           # Socket.IO signaling: join/leave/kick, seat grace period, Redis adapter
  lib/                # redis (atomic Lua scripts), rateLimit (Redis fixed window)
  features/reports/   # abuse reports; features/admin/ moderation queue
  routes/             # /api/v1 router
  services/           # shared services (jwt, ice)
  types/express.d.ts  # req.user / req.auth / res.sendResponse typings
tests/                # integration tests (real Postgres + Redis, real sockets)
  utils/
```

Imports use `.js` extensions (NodeNext ESM) even though the files are `.ts`.

## Adding a feature

1. Add a table in `src/db/schema/<name>.ts` and export it from `schema/index.ts`
2. `pnpm db:generate && pnpm db:migrate`
3. Create `src/features/<name>/{routes,controllers,services}.ts`
4. Mount the router in `src/routes/index.routes.ts`

## Profile and onboarding

New accounts (and old accounts that never filled in a profile) have `onboarded_at = null`; the web app
sends them to `/onboarding` until it is set. Lists, limits and suggestions live in
`src/config/profile.config.ts` and are served to the web app, so changing them needs no web edit.

| Endpoint | What it does |
| --- | --- |
| `GET /users/options` | Genders, languages, interest/skill suggestions and limits |
| `GET /users/me` | Your profile, including `gender`, `onboardedAt` and `hasPassword` (false for Google accounts) |
| `POST /users/me/onboarding` | Saves the onboarding answers and sets `onboardedAt`. Gender, 1+ language, 1+ interest and 1+ skill are required; the bio is optional. Safe to repeat |
| `PATCH /users/me` | Edits only the fields sent (name, username, gender, bio, languages, interests, skills). Lists and the bio may be emptied |
| `POST /auth/change-password` | Needs the current password. Signs out every other session and returns a fresh token for this one. Rate limited. Not available to Google-only accounts |

## Google login

`lib/better-auth.ts` runs better-auth stateless (no database) just for the Google OAuth
handshake. `GET /api/v1/auth/google/complete` then finds or creates the user in `users`
and redirects to the web app with our normal JWT. Register this redirect URI in Google Cloud:
`<BETTER_AUTH_URL>/api/v1/better-auth/callback/google` (locally `http://localhost:3000/api/v1/better-auth/callback/google`)

## Rooms & signaling

Rooms are ephemeral and live **only in Redis** (`features/rooms/store.ts`); Postgres is untouched.
Central settings (max members, id/code lengths, grace periods, rate limits, languages, purposes)
are in `src/config/rooms.config.ts`; `ROOM_MAX_MEMBERS` overrides the member limit via env. The web app
reads these from `GET /api/v1/rooms/config`.

| REST (JWT) | |
| --- | --- |
| `GET /rooms/config` | limits + language/purpose options |
| `GET /rooms?language=&purpose=&tags=a,b&q=&hasSpace=true` | public rooms (only ones someone is inside) |
| `POST /rooms` | create (public: 6-letter id; private: also a 6-digit join code) |
| `GET /rooms/:id` | safe preview for the pre-join screen |

Signaling is Socket.IO at `/api/v1/realtime` (auth: `{ token }`). Events: `room:join` (ack),
`room:leave`, `signal` (relayed offer/answer/ICE) and server -> client `peer:joined`, `peer:left`,
`room:replaced`. Audio and chat never reach the server; they go peer-to-peer over WebRTC.

## Security model in one paragraph

A JWT only says *who* you are and which token generation you belong to (`tv`). Every protected request
re-reads the account (status, role, token version) from the database, so bans, demotions and
"log out everywhere" apply immediately. Tokens last 1 h and are refreshed by the web app. Login and
register are rate limited per IP **and** per account in Redis; room join codes, previews and reports are
rate limited too. Role checks use `req.auth` (database), never claims inside the token.
