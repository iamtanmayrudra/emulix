import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" subtitle="Back in three quick steps. No support ticket needed." icon="mail">
      <ForgotPasswordFlow />
    </AuthCard>
  );
}
