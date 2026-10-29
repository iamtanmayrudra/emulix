import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthStage } from "@/components/auth/auth-stage";
import { Logo } from "@/components/logo";

const SECURITY = ["Salted password hashes", "HTTP-only session cookies", "Brief lock after repeated failures"];

/**
 * Brand panel beside the form on wide screens. The devices in the middle react to what you do in the form,
 * so the page shows what the product does: the same account on every screen. Hidden on small screens.
 */
export function AuthShowcase() {
  return (
    <AuthPanel>
      <Link href="/" aria-label="Emulix home" className="relative inline-flex w-fit">
        <Logo size={30} />
      </Link>

      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Website and app testing
        </p>
        <h2 className="mt-5 max-w-md text-4xl font-bold leading-[1.15] tracking-tight">
          Check every screen{" "}
          <span className="bg-gradient-to-r from-sky-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            before your users do.
          </span>
        </h2>
        <p className="mt-3 max-w-sm text-sm text-white/70">Start typing and watch these two devices follow along.</p>
      </div>

      <div className="relative">
        <AuthStage />
      </div>

      <ul aria-label="Security by default" className="relative flex flex-wrap gap-2">
        {SECURITY.map((item) => (
          <li key={item} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80">
            <span aria-hidden="true" className="text-emerald-400">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </AuthPanel>
  );
}
