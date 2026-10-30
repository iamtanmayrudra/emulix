import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthCardSkeleton } from "@/components/skeleton";

type Props = { searchParams: Promise<{ token?: string }> };

export default function InvitePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<AuthCard title="Join your organization"><AuthCardSkeleton /></AuthCard>}>
      <InviteContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InviteContent({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard title="Invitation not valid" icon="alert">
        <p className="text-sm text-muted">This invitation link is incomplete. Ask your super admin to send a new one.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-accent">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Join your organization" subtitle="Choose a password and you are in. Your super admin decides when you get a seat." icon="key">
      <AuthForm
        endpoint="/api/org/invite/accept"
        hidden={{ token }}
        successHref="/login?joined=1"
        submitLabel="Create my account"
        fields={[
          {
            name: "password",
            label: "Choose a password",
            type: "password",
            autoComplete: "new-password",
            minLength: 12,
            meter: true,
            help: "Use at least 12 characters. A longer phrase is stronger.",
          },
        ]}
        footer={
          <Link href="/login" className="font-medium text-accent">
            Already have an account? Sign in
          </Link>
        }
      />
    </AuthCard>
  );
}
