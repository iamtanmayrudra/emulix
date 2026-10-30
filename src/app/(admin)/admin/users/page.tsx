import { Suspense } from "react";
import { UsersAdmin } from "@/components/admin/users-admin";
import { SimplePageSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getOrgService } from "@/lib/org/runtime";

async function UsersContent() {
  const user = await getCurrentUser();
  // The layout has already confirmed a super admin. This read is for the first paint.
  const initial = await getOrgService().listMembers(user!);
  return <UsersAdmin initial={initial} selfId={user!.id} />;
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<SimplePageSkeleton label="Loading users" rows={6} />}>
      <UsersContent />
    </Suspense>
  );
}
