import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-prose py-6 pb-28">
      <Skeleton className="h-8 w-2/3 mb-2" />
      <Skeleton className="h-8 w-1/2 mb-5" />
      <Skeleton className="h-14 w-full rounded-[14px] mb-5" />
      <Skeleton className="h-24 w-full rounded-[14px] mb-4" />
      <ListSkeleton rows={4} />
    </div>
  );
}
