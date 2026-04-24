import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-prose py-6 pb-28">
      <Skeleton className="h-8 w-40 mb-4" />
      <Skeleton className="h-11 w-full rounded-[12px] mb-3" />
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}
