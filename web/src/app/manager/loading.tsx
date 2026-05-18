import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-prose py-6 pb-28">
      <Skeleton className="h-8 w-40 mb-4" />
      <div className="flex gap-3 mb-4">
        <Skeleton className="h-10 w-32 rounded-[12px]" />
        <Skeleton className="h-10 w-28 rounded-[12px]" />
        <Skeleton className="h-10 w-36 rounded-[12px]" />
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}
