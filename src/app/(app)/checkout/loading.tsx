import { CardSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading checkout" className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton lines={5} />
        </div>
        <CardSkeleton lines={3} />
      </div>
    </LoadingRegion>
  );
}
