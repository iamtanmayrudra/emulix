import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { ResetSuccessNotice } from "@/components/auth/reset-success-notice";
import { AuthCardSkeleton } from "@/components/skeleton";

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" subtitle="Welcome back to Emulix." icon="signin">
      <Suspense fallback={<AuthCardSkeleton />}>
        <ResetSuccessNotice />
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
