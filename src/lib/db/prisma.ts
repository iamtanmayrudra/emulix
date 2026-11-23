import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per server process, kept on globalThis so hot reloads in development do not open a new pool each time.
 * The pool is small on purpose: every serverless instance opens its own, and Postgres hosts cap total connections.
 */
const globalForPrisma = globalThis as typeof globalThis & { __emulixPrisma?: PrismaClient };

/** DATABASE_URL, or the NETLIFY_DB_URL that Netlify Database sets for you. Null when neither is set. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = (env.DATABASE_URL || env.NETLIFY_DB_URL || env.NETLIFY_DATABASE_URL)?.trim();
  return url ? url : null;
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__emulixPrisma) {
    const url = databaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set.");
    globalForPrisma.__emulixPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3 }) });
  }
  return globalForPrisma.__emulixPrisma;
}
