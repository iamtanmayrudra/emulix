import { Suspense } from "react";
import { ReportsExplorer } from "@/components/reports/reports-explorer";
import { SimplePageSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { listReports } from "@/lib/reports";

async function ReportsContent() {
  const user = await getCurrentUser();
  // The layout has already confirmed a signed-in member who may use the platform.
  return <ReportsExplorer initial={listReports(user!.id)} />;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<SimplePageSkeleton label="Loading reports" rows={6} />}>
      <ReportsContent />
    </Suspense>
  );
}
