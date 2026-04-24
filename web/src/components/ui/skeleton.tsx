import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-warm-sand rounded-[8px] animate-pulse",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="bg-ivory rounded-[14px] p-4 space-y-3"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      aria-busy="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="bg-ivory rounded-[14px] px-4"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      aria-busy="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center justify-between py-[14px] ${
            i > 0 ? "border-t border-border-cream" : ""
          }`}
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}
