import {
  CardSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/ui/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <CardSkeleton key={idx} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <PanelSkeleton className="lg:col-span-7" />
        <PanelSkeleton className="lg:col-span-5" />
      </div>
    </div>
  );
}
