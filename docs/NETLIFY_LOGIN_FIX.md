# Fixing sign-in on Netlify

The problem, why it happens, and the steps that fix it with **Netlify Database** (Netlify's built-in Postgres). Read
[DATABASE.md](DATABASE.md) for how the database layer is built.

## The symptom

On the live site (`https://emulixoptimizer.netlify.app`):

- Sign-up works, but sign-in then says **"Email or password is incorrect."** (HTTP 401, `invalid_credentials`).
- Signing in with the demo login `admin` / `admin` gives the same message.

The message is accurate. The server looked up the account and did not find it.

## Why it happens

Netlify runs the site as many short-lived server instances. Until a database is connected, accounts are kept in each
instance's own memory:

- An account made on one instance does not exist on the next one, so sign-in fails after a successful sign-up.
- Nothing is saved when an instance stops.
- No users exist in production by default. The development logins (`admin`, `free`, ...) are only created on a developer's
  machine, never on the deployed site.

The fix is a Postgres database that every instance shares.

## Earlier problems that are already fixed

| Problem | Fix |
| --- | --- |
| Sign-in and sign-up returned 500 on Netlify (`APP_URL is not set`) | The public URL is now read only when an email is built, so a missing setting fails one email, not sign-in |
| Sign-in failed on a different server instance than the one that created the account | Accounts, sessions and tokens are stored in Postgres when a database URL is present |
| `Could not validate instant … NEXT_REDIRECT` in the dev terminal after a restart | Pages under the signed-in layouts opt out of the dev-only instant check |

## How the fix works on Netlify Database

| What | How |
| --- | --- |
| The database | Created once in Netlify: project → Data & storage → Database. Already done for `emulixoptimizer` |
| The connection | Netlify gives functions the URL in `NETLIFY_DB_URL` automatically. The app reads it. No `DATABASE_URL` is needed on Netlify |
| The tables | `netlify/database/migrations/20261120000000_create_auth_tables.sql`. Netlify applies new files in that folder just before each production deploy goes live. A failing migration blocks the deploy |
| The demo account | `netlify/database/migrations/20261120000001_create_demo_admin.sql`, applied the same way. Login `admin`, password `admin`, Pro plan, already verified |
| Deploy previews | Get their own copy of the database, so they never change production data |

Production deploys are the only ones that touch the real database. Do not edit a migration file after it has been
deployed. Add a new file instead.

## Steps

### 1. Deploy the code

The migration files and the code that reads `NETLIFY_DB_URL` must be on the branch Netlify builds (`main`). Commit and push
them. Netlify builds, applies the two migrations to the production database, then publishes the deploy.

If auto publishing is off for the site, publish the deploy yourself. The migrations run when you publish.

### 2. Set the email variables (optional, for verification emails)

In Netlify → Environment variables:

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://emulixoptimizer.netlify.app` |
| `RESEND_API_KEY` | your Resend key |
| `EMAIL_FROM` | a sender on a domain verified in Resend |

Sign-in works without these. Only the emails need them. Variables take effect on the next deploy.

### 3. Check it

1. Open `/login`, sign in with `admin` / `admin`.
2. Open `/profile`. It should show the **Pro** plan.
3. Sign up a second account, sign out, and sign in again. This is the case that used to fail.

## If it still fails

| What you see | Meaning | What to do |
| --- | --- | --- |
| The deploy fails at "applying migrations" | A migration could not run | Open the deploy log. The error names the SQL line |
| "Email or password is incorrect." for `admin` | The deploy that has the migrations is not published yet, or the demo migration was removed | Check Deploys: the latest production deploy must be published |
| Netlify function log shows `[auth] DATABASE_URL is not set` | The site cannot see the database URL | Confirm the database exists under Data & storage → Database, then redeploy. As a fallback, add `DATABASE_URL` yourself in Environment variables |
| "Something went wrong. Try again." (HTTP 500) and a log line about a missing table | The tables were not created | Confirm the migration files are on `main` and the deploy that includes them was published |
| Sign-up says "Check your email" but no email arrives | Resend is not configured | Set `RESEND_API_KEY` and `EMAIL_FROM`. See [EMAIL_SERVICE.md](EMAIL_SERVICE.md). Sign-in works without it |

Netlify function logs: Netlify → your site → Logs → Functions.

## About the demo login

`admin` / `admin` is guessable. On a public site anyone can try it and get a Pro account. It exists only because of the
demo migration, and it is created on the first deploy that contains it.

To remove it after the demo, add a new file, for example `netlify/database/migrations/20261201000000_remove_demo_admin.sql`:

```sql
DELETE FROM "User" WHERE "email" = 'admin';
```

Deploy it. Do not edit or delete the original demo file. To change the password instead, ask for a new migration that
updates the hash.

## Using a different Postgres (Neon, Supabase, Railway)

Set `DATABASE_URL` in Netlify and in your local `.env`, then run these from the project folder:

```powershell
npm run db:migrate
```

```powershell
npm run db:seed-demo
```

```powershell
npm run db:check
```

`db:check` prints no secrets and says what to run if something is missing. `NETLIFY_DB_URL` is ignored when
`DATABASE_URL` is set.

The tables live in two folders on purpose: `prisma/migrations` for `db:migrate`, and `netlify/database/migrations` for
Netlify. A test (`tests/migrations-sync.test.ts`) fails if the two copies of the table SQL differ.

## Still in memory after this fix

These are not in the database yet, so on Netlify they can behave differently between requests:

- Organizations, seats and invites (the super-admin area, [SUPER_ADMIN.md](SUPER_ADMIN.md)).
- Sign-in and sign-up rate limits, and the AI credit counter.

Moving organizations to Postgres is the next step if the super-admin area is part of the demo.
