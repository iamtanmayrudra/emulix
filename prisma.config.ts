import { defineConfig } from "prisma/config";

// Prisma does not read .env by itself. Locally run it as: node --env-file=.env node_modules/prisma/build/index.js migrate deploy
// (the npm scripts db:migrate and db:status do this). On Netlify, set DATABASE_URL in the site's environment variables.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // generate does not connect, so an empty value is fine there. Migrations fail clearly if it is missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
