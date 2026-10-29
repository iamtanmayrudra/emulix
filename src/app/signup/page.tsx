import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" subtitle="Free to start. Upgrade to Pro any time." icon="signup">
      <AuthForm
        endpoint="/api/auth/signup"
        submitLabel="Create account"
        fields={[
          { name: "name", label: "Name", type: "text", autoComplete: "name" },
          { name: "email", label: "Work email", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            minLength: 12,
            meter: true,
            help: "Use at least 12 characters. A longer phrase is stronger.",
          },
        ]}
        notice={
          <p>
            By creating an account you agree to the terms and privacy policy. Testing starts after you verify your email.
          </p>
        }
        footer={
          <p className="text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent">
              Sign in
            </Link>
          </p>
        }
      />

    </AuthCard>
  );
}
