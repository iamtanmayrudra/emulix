import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { ResetSteps } from "@/components/auth/reset-steps";
import { AuthCardSkeleton } from "@/components/skeleton";

type Props = { searchParams: Promise<{ token?: string }> };

export default function ResetPasswordPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<AuthCard title="Choose a new password"><AuthCardSkeleton /></AuthCard>}>
      <ResetPasswordForm searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordForm({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard title="Link not valid" icon="alert">
        <p className="text-sm text-muted">This reset link is incomplete. Request a new one.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-accent">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Last step. This also signs you out of other devices." icon="key">
      <ResetSteps current={3} />
      <AuthForm
        endpoint="/api/auth/reset-password"
        hidden={{ token }}
        successHref="/login?reset=1"
        submitLabel="Update password"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
            minLength: 12,
            meter: true,
            help: "Use at least 12 characters. A longer phrase is stronger.",
          },
        ]}
        footer={
          <Link href="/login" className="font-medium text-accent">
            Go to sign in
          </Link>
        }
      />
    </AuthCard>
  );
}
