import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client";
import { DevelopmentMailer } from "../src/lib/auth/mailer";
import { PrismaAuthStore } from "../src/lib/auth/prisma-store";
import { AuthFailure, createAuthService } from "../src/lib/auth/service";

/**
 * Runs the SQL files in netlify/database/migrations in order on a real Postgres (PGlite), the way Netlify does on a
 * production deploy, then signs in through the real auth service.
 */
const DIR = "netlify/database/migrations";

let pg: PGlite;
let prisma: PrismaClient;

beforeAll(async () => {
  pg = new PGlite();
  for (const file of readdirSync(DIR).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(`${DIR}/${file}`, "utf8"));
  }
  prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
});

afterAll(async () => {
  await prisma.$disconnect();
  await pg.close();
});

function service() {
  return createAuthService({
    store: new PrismaAuthStore(prisma),
    mailer: new DevelopmentMailer({ log: false }),
    appUrl: "http://test.local",
  });
}

describe("Netlify migrations", () => {
  it("name every file as <number>_<slug>, as Netlify requires", () => {
    for (const file of readdirSync(DIR)) expect(file).toMatch(/^\d+_[a-z0-9_-]+\.sql$/);
  });

  it("create a demo account that signs in with admin / admin, on the Pro plan", async () => {
    const result = await service().login({ email: "admin", password: "admin" });
    expect(result.user.email).toBe("admin");
    expect(result.user.subscription).toBe("active");
    expect(result.user.emailVerifiedAt).not.toBeNull();
    expect((await service().getSessionUser(result.sessionToken))?.id).toBe("demo-admin");
  });

  it("refuse a wrong password for the demo account", async () => {
    await expect(service().login({ email: "admin", password: "not-admin" })).rejects.toBeInstanceOf(AuthFailure);
  });

  it("leave the tables usable for ordinary sign-up and sign-in", async () => {
    const auth = service();
    await auth.signUp({ email: "ana@example.com", name: "Ana", password: "correct horse battery" });
    const result = await auth.login({ email: "ana@example.com", password: "correct horse battery" });
    expect(result.user.subscription).toBeUndefined();
  });
});
