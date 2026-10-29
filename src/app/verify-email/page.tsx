import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailStatus } from "@/components/auth/verify-email-status";
import { LoadingRegion, Skeleton } from "@/components/skeleton";

/** Shown while the verification link is checked. */
function VerifyingSkeleton() {
  return (
    <LoadingRegion label="Confirming your email" className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </LoadingRegion>
  );
}

type Props = { searchParams: Promise<{ token?: string }> };

export default function VerifyEmailPage({ searchParams }: Props) {
  return (
    <AuthCard title="Verify your email" subtitle="Confirm your email to start testing." icon="mail">
      <Suspense fallback={<VerifyingSkeleton />}>
        <VerifyEmailContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function VerifyEmailContent({ searchParams }: Props) {
  const { token } = await searchParams;
  return <VerifyEmailStatus token={token} />;
}
