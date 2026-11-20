import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ReportsExplorer } from "@/components/reports/reports-explorer";
import { SimplePageSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { listReports } from "@/lib/reports";

async function ReportsContent() {
  const user = await getCurrentUser();
  // The layout sends signed-out visitors to sign-in, but it renders at the same time as this page, so check here too.
  if (!user) redirect("/login");
  return <ReportsExplorer initial={listReports(user.id)} />;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<SimplePageSkeleton label="Loading reports" rows={6} />}>
      <ReportsContent />
    </Suspense>
  );
}

/** Signed-in only: the layout reads the session and may redirect, so this page cannot be validated as instant. See the layout. */
export const instant = false;
