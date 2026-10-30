import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { NoSeatActions } from "@/components/no-seat-actions";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getUserAccess } from "@/lib/org/runtime";

async function NoSeatContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = getUserAccess(user.id);
  // Only members without a seat belong here. Everyone else goes to their own place.
  if (access.kind !== "no_seat") redirect(access.kind === "super_admin" ? "/admin/users" : access.kind === "deactivated" ? "/login" : "/dashboard");

  return (
    <section aria-labelledby="no-seat-heading" className="mx-auto max-w-lg space-y-6 rounded-3xl border border-border/70 bg-surface p-8 text-center shadow-xl">
      <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet text-white shadow-lg shadow-brand-violet/30">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      </span>
      <div className="space-y-2">
        <h1 id="no-seat-heading" className="text-2xl font-semibold tracking-tight">You don&rsquo;t have a seat</h1>
        <p className="text-muted">
          Hi {user.name.split(" ")[0]}. Your organization has a limited number of seats, and you are signed in without one. Ask your
          super admin to give you a seat, and you can start testing.
        </p>
      </div>
      <NoSeatActions email={user.email} />
    </section>
  );
}

export default function NoSeatPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-chrome text-chrome-foreground">
        <div className="flex h-14 items-center px-4 md:px-6">
          <Link href="/" aria-label="Emulix home">
            <Logo size={26} />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Suspense fallback={<Skeleton className="h-80 w-full max-w-lg rounded-3xl" />}>
          <NoSeatContent />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
