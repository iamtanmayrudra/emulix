import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Emulix · Test and optimize on real devices",
  description:
    "Open your site in live browsers on iPhones, Androids, Macs and more, and audit it for speed, accessibility and SEO.",
  applicationName: "Emulix",
};

/** The address bar and task switcher take the dark header colour. */
export const viewport: Viewport = {
  themeColor: "#0d0f2e",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
