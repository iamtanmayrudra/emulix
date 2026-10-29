"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/next-path";

/** The sign-in form. After signing in it opens the page in ?next=, for example the checkout, or the dashboard. */
export function LoginForm() {
  const next = safeNextPath(useSearchParams().get("next"));
  return (
    <AuthForm
      endpoint="/api/auth/login"
      submitLabel="Sign in"
      successHref={next}
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Link href="/signup" className="font-medium text-accent">
            Create an account
          </Link>
          <Link href="/forgot-password" className="font-medium text-accent">
            Forgot password?
          </Link>
        </div>
      }
    />
  );
}
