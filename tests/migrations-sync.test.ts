import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The tables are defined twice on purpose: prisma/migrations is for `npm run db:migrate` (any Postgres), and
 * netlify/database/migrations is what Netlify Database applies by itself on each production deploy. Both are the SQL
 * Prisma generates from prisma/schema.prisma, so they must stay identical.
 */
describe("migrations", () => {
  it("are the same SQL in the Prisma folder and the Netlify folder", () => {
    const prisma = readFileSync("prisma/migrations/20261120000000_init/migration.sql", "utf8");
    const netlify = readFileSync("netlify/database/migrations/20261120000000_create_auth_tables.sql", "utf8");
    expect(netlify).toBe(prisma);
  });
});
