import Link from "next/link";

/** Few links, all to pages that exist. */
const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Plans" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

/** One slim row: the brand on the left, a handful of links on the right. */
export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border bg-surface/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-xs md:px-6">
        <p className="text-muted">
          <span className="font-semibold text-foreground">Emulix</span> · Test and optimize on real devices
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
