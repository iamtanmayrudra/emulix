import { PublicPageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <PublicPageSkeleton label="Loading pricing" />
    </div>
  );
}
