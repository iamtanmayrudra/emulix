// Creates (or resets) a demo account on the Pro plan in the database named by DATABASE_URL.
//
//   npm run db:seed-demo
//
// Login "admin", password "admin", unless DEMO_ADMIN_LOGIN / DEMO_ADMIN_PASSWORD are set.
// Run it yourself against the database you want. Nothing runs it automatically, and the deployed site never creates it.
//
// WARNING: a login this simple is guessable. Anyone who opens the site's sign-in page can try "admin" / "admin" and get
// a Pro account. Use it for a demo, then remove it with: npm run db:seed-demo -- --remove
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const login = (process.env.DEMO_ADMIN_LOGIN || "admin").trim().toLowerCase();
const password = process.env.DEMO_ADMIN_PASSWORD || "admin";
const url = (process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL || "").trim();

if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env first (see docs/DATABASE.md).");
  process.exit(1);
}

// Same format as src/lib/auth/password.ts: scrypt$N$r$p$saltHex$hashHex
async function hash(value) {
  const salt = randomBytes(16);
  const key = await promisify(scrypt)(value, salt, 64, { N: 16384, r: 8, p: 1 });
  return ["scrypt", 16384, 8, 1, salt.toString("hex"), key.toString("hex")].join("$");
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (process.argv.includes("--remove")) {
    const { rowCount } = await client.query('DELETE FROM "User" WHERE "email" = $1', [login]);
    console.log(rowCount ? `Removed the demo account "${login}".` : `No account "${login}" found.`);
  } else {
    await client.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "emailVerifiedAt", "failedLogins", "lockedUntil", "createdAt", "subscription")
       VALUES ('demo-admin', $1, 'Admin', $2, now(), 0, NULL, now(), 'active')
       ON CONFLICT ("email") DO UPDATE SET
         "passwordHash" = EXCLUDED."passwordHash",
         "emailVerifiedAt" = COALESCE("User"."emailVerifiedAt", EXCLUDED."emailVerifiedAt"),
         "failedLogins" = 0,
         "lockedUntil" = NULL,
         "subscription" = 'active'`,
      [login, await hash(password)],
    );
    console.log(`Demo account ready: login "${login}", Pro plan. Remove it afterwards with: npm run db:seed-demo -- --remove`);
  }
} finally {
  await client.end();
}
