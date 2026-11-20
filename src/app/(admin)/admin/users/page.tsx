import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UsersAdmin } from "@/components/admin/users-admin";
import { SimplePageSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getOrgService } from "@/lib/org/runtime";

async function UsersContent() {
  const user = await getCurrentUser();
  // The layout sends anyone else away, but it renders at the same time as this page, so check here too.
  if (!user) redirect("/login");
  const initial = await getOrgService().listMembers(user);
  return <UsersAdmin initial={initial} selfId={user.id} />;
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<SimplePageSkeleton label="Loading users" rows={6} />}>
      <UsersContent />
    </Suspense>
  );
}

/** Signed-in only: the layout reads the session and may redirect, so this page cannot be validated as instant. See the layout. */
export const instant = false;
