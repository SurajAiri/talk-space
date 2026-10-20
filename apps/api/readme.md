# API

Express 5 + TypeScript + Drizzle ORM (PostgreSQL).

## Setup

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL, JWT_SECRET and the Google/better-auth vars
npm run db:migrate        # apply migrations in ./drizzle
npm run dev               # tsx watch, http://localhost:3000/api/v1/health
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run `src/index.ts` with auto-reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:generate` | Generate a migration after editing `src/db/schema` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema straight to the DB (dev only) |
| `npm run db:studio` | Open Drizzle Studio |

## Structure

```
src/
  index.ts            # entry: DB check, listen, graceful shutdown
  app.ts              # express app + middleware order
  config/env.ts       # env loading and validation
  db/                 # drizzle client + schema/ (one file per table)
  features/<name>/    # routes.ts -> controllers.ts -> services.ts
  middlewares/        # response, authorization, error handling
  routes/             # /api/v1 router
  services/           # shared services (jwt)
  types/express.d.ts  # req.user / res.sendResponse typings
  utils/
```

Imports use `.js` extensions (NodeNext ESM) even though the files are `.ts`.

## Adding a feature

1. Add a table in `src/db/schema/<name>.ts` and export it from `schema/index.ts`
2. `npm run db:generate && npm run db:migrate`
3. Create `src/features/<name>/{routes,controllers,services}.ts`
4. Mount the router in `src/routes/index.routes.ts`

## Google login

`lib/better-auth.ts` runs better-auth stateless (no database) just for the Google OAuth
handshake. `GET /api/v1/auth/google/complete` then finds or creates the user in `users`
and redirects to the web app with our normal JWT. Register this redirect URI in Google Cloud:
`http://localhost:5173/api/v1/better-auth/callback/google`
