export function CardSkeleton() {
  return (
    <div className="card h-32 animate-pulse p-4">
      <div className="h-full rounded-md bg-border-subtle" />
    </div>
  );
}

export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={`card ${className ?? ""}`}>
      <div className="border-b border-border-subtle px-4 py-4">
        <div className="h-5 w-40 animate-pulse rounded-md bg-border-subtle" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="h-16 animate-pulse rounded-lg border border-border-subtle bg-surface-raised"
          />
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-48 animate-pulse rounded-md bg-border-subtle" />
      <div className="h-4 w-60 animate-pulse rounded-md bg-border-subtle" />
    </div>
  );
}
