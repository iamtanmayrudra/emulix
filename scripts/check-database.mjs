// Reports whether the database named by DATABASE_URL is ready for sign-in. Prints no secrets.
//
//   npm run db:check
//
// Checks: it connects, the tables exist, how many accounts there are, and whether the demo account exists and is Pro.
import pg from "pg";

const login = (process.env.DEMO_ADMIN_LOGIN || "admin").trim().toLowerCase();
const url = (process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL || "").trim();

if (!url) {
  console.error("FAIL  DATABASE_URL is not set in .env (see docs/NETLIFY_LOGIN_FIX.md, step 2).");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(not a valid URL)";
  }
})();

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
} catch (error) {
  console.error(`FAIL  Cannot connect to ${host}: ${error.message}`);
  console.error("      Check the string, and that it ends with ?sslmode=require if the host needs SSL.");
  process.exit(1);
}

let failed = false;
try {
  console.log(`OK    Connected to ${host}`);
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('User','Session','Token','EmailLog')`,
  );
  const missing = ["User", "Session", "Token", "EmailLog"].filter((name) => !tables.some((row) => row.table_name === name));
  if (missing.length > 0) {
    failed = true;
    console.error(`FAIL  Missing tables: ${missing.join(", ")}. Run: npm run db:migrate`);
  } else {
    console.log("OK    Tables exist");
    const { rows: count } = await client.query('SELECT count(*)::int AS n FROM "User"');
    console.log(`OK    ${count[0].n} account(s) in the database`);
    const { rows } = await client.query('SELECT "subscription", "emailVerifiedAt" FROM "User" WHERE "email" = $1', [login]);
    if (rows.length === 0) {
      failed = true;
      console.error(`FAIL  No account "${login}". Run: npm run db:seed-demo`);
    } else {
      const plan = rows[0].subscription === "active" ? "Pro" : "Free";
      console.log(`OK    Account "${login}" exists (${plan}, ${rows[0].emailVerifiedAt ? "verified" : "not verified"})`);
    }
  }
} finally {
  await client.end();
}
process.exit(failed ? 1 : 0);
