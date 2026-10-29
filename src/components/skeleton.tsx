import type { ReactNode } from "react";

/**
 * Placeholder blocks shown while data loads. They keep the layout of the real content so the page does not
 * jump when it arrives. The shimmer is a moving highlight; reduced motion keeps a still block.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-md bg-border/70 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] motion-reduce:before:animate-none dark:before:via-white/10 ${className}`}
    />
  );
}

/** Announces a loading region to assistive technology once, instead of announcing every block. */
export function LoadingRegion({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Heading and body lines for a page while its content loads. */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Stat tiles, as on the dashboard. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** A list of rows, as in job history or recent activity. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </li>
      ))}
    </ul>
  );
}

/** A card with a title and a few lines, for panels such as usage or profile details. */
export function CardSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-4 rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-3 ${index % 2 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Whole-page placeholder: header, optional stats, and a content area split into a list and a side panel. */
export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard" className="space-y-8">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <StatRowSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RowsSkeleton rows={4} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Placeholder for a page with a heading and one content card. */
export function SimplePageSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <LoadingRegion label={label} className="space-y-6">
      <PageHeaderSkeleton />
      <RowsSkeleton rows={rows} />
    </LoadingRegion>
  );
}

/** Placeholder for a profile or billing page: a header, a details card and a plan card. */
export function ProfileSkeleton() {
  return (
    <LoadingRegion label="Loading profile" className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={3} />
      </div>
    </LoadingRegion>
  );
}

/** Placeholder for the public pages: a hero block and a row of cards. */
export function PublicPageSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="space-y-8">
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    </LoadingRegion>
  );
}

/** Placeholder for the auth form column while the form's state is read. */
export function AuthCardSkeleton() {
  return (
    <LoadingRegion label="Loading" className="space-y-5 rounded-2xl border border-border bg-surface p-6">
      <Skeleton className="mx-auto h-8 w-40" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </LoadingRegion>
  );
}
