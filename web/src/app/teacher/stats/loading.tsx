import { Skeleton, CardSkeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-prose py-6 pb-28">
      <Skeleton className="h-8 w-40 mb-4" />
      <div className="grid grid-cols-3 gap-[10px] mb-4">
        <Skeleton className="h-24 rounded-[14px]" />
        <Skeleton className="h-24 rounded-[14px]" />
        <Skeleton className="h-24 rounded-[14px]" />
      </div>
      <CardSkeleton rows={4} />
      <div className="mt-4">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
