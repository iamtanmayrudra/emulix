# Database

Status: **built for accounts.** Users, sessions, one-time tokens (verify email, reset password) and the email log are
stored in Postgres through [Prisma](https://www.prisma.io). Organizations, seats and invites ([SUPER_ADMIN.md](SUPER_ADMIN.md))
are **not** moved yet and are still in memory.

## Why

On Netlify (and Vercel) a site runs as many short-lived server instances. With in-memory storage an account made on one
instance does not exist on the next, so sign-up worked and sign-in then failed. A shared database fixes that.

## Setup

1. Create a Postgres database. [Netlify DB](https://docs.netlify.com/build/data-and-storage/netlify-db/) (Neon) is the
   quickest on Netlify. Neon, Supabase and Railway also work.
2. Put its connection string in `DATABASE_URL`: in `.env` for the commands below, and in the Netlify site's
   environment variables for the running site. Netlify DB sets `NETLIFY_DATABASE_URL`, which is read too.

   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
   ```

3. Create the tables once, from your machine:

   ```powershell
   npm run db:migrate
   ```

   `npm run db:status` shows whether the database is up to date. Run `db:migrate` again whenever a new folder appears in
   `prisma/migrations/`.
4. Redeploy. The build runs `prisma generate` for you (`npm run build`, and on every `npm install`).

| Situation | What happens |
| --- | --- |
| `DATABASE_URL` set | Accounts live in Postgres |
| Not set, development | In-memory store, with the development logins (`admin`, `free`, ...) |
| Not set, production | In-memory store and a warning in the server log. Sign-in is unreliable on multi-instance hosts |

With a database the development logins are **not** created, because they live only in the in-memory store. Leave
`DATABASE_URL` out of `.env` to keep using them locally.

## Demo account (for showing the site)

```powershell
npm run db:seed-demo
```

Creates login `admin`, password `admin`, on the Pro plan, already verified, in the database `DATABASE_URL` points at.
Running it again resets that account. Set `DEMO_ADMIN_LOGIN` and `DEMO_ADMIN_PASSWORD` in `.env` to use other values.
Nothing runs this for you and the deployed site never creates it.

Anyone who finds the sign-in page can try `admin` / `admin`, and then has a Pro account. Remove it when the demo is
over, or give it a real password first:

```powershell
npm run db:seed-demo -- --remove
```

## How it is built

| Part | Where |
| --- | --- |
| Tables | `prisma/schema.prisma`, SQL in `prisma/migrations/` |
| Connection settings for the Prisma CLI | `prisma.config.ts` |
| One client per process, small pool | `src/lib/db/prisma.ts` |
| The store the auth service talks to | `AuthStore` in `src/lib/auth/store.ts` |
| Postgres version of it | `src/lib/auth/prisma-store.ts` |
| Picks memory or Postgres | `getAuthStore()` |
| Tests | `tests/auth-store.test.ts` |

The Prisma client is generated into `src/generated/prisma/` and is not committed.

`tests/auth-store.test.ts` runs the same cases against the in-memory store and the Postgres store (PGlite, a real
Postgres running inside the test, using the project's own migration). The two must behave identically.

Things the Postgres store does on purpose:

- A reset or verify link is claimed with one conditional `UPDATE`, so two requests using the same link cannot both win.
- Two accounts can never share an email: the unique index decides, even when requests race.
- Session cookies and emailed tokens are stored only as sha256 hashes.
- The pool is capped at 3 connections per instance, because every serverless instance opens its own.

## Changing the tables

1. Edit `prisma/schema.prisma`.
2. Make the SQL: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, or run
   `npx prisma migrate dev --name what_changed` against a development database.
3. Commit the new folder under `prisma/migrations/`, then run `npm run db:migrate` against each database.

## Not built yet

- Moving organizations, seats and invites to the database.
- Rate limits and the AI credit counter are still per-process memory (a shared store such as Redis).
- Cleaning up expired sessions and used tokens.
