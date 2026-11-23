import { connection } from "next/server";
import { NextResponse } from "next/server";
import { databaseUrl } from "@/lib/db/prisma";
import { hasLocalBrowser } from "@/lib/testing/environment";

/**
 * A setup check for whoever runs the site. It reports only yes or no for each setting, never a value, so it is safe to
 * leave public. Open /api/health to see what the running site can see, without reading server logs.
 */
export async function GET() {
  // Reads the environment of the running server, so it must never be prerendered at build time.
  await connection();
  const key = process.env.PAGESPEED_API_KEY?.trim() ?? "";
  return NextResponse.json(
    {
      database: Boolean(databaseUrl()),
      appUrl: Boolean(process.env.APP_URL?.trim()),
      email: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()),
      audits: {
        // Without a browser the audit runs through PageSpeed Insights and needs the key.
        mode: hasLocalBrowser() ? "local-browser" : "pagespeed",
        keyPresent: key.length > 0,
        // A Google API key starts with "AIza" and is 39 characters. False usually means a copy and paste mistake.
        keyLooksValid: /^AIza[0-9A-Za-z_-]{35}$/.test(key),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
