export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-border-subtle" />
        <div className="h-4 w-60 animate-pulse rounded-md bg-border-subtle" />
      </div>
      <div className="card h-24 animate-pulse" />
      <div className="card h-96 animate-pulse" />
    </div>
  );
}
