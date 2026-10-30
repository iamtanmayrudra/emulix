import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { SimplePageSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getOrgService, getUserAccess } from "@/lib/org/runtime";

/** Only an active super admin gets in. Everyone else is sent to where they belong. Enforced on the server. */
async function AdminGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = getUserAccess(user.id);
  if (access.kind !== "super_admin") redirect(access.kind === "no_seat" ? "/no-seat" : access.kind === "deactivated" ? "/login" : "/dashboard");
  const orgName = await getOrgService().orgName(user);
  return (
    <AdminShell userName={user.name} orgName={orgName}>
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <SimplePageSkeleton label="Loading admin" rows={5} />
        </div>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
