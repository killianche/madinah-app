import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return (
    <AppShell title="Требует внимания">
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-ivory rounded-[14px] p-4 animate-pulse"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            <div className="h-4 w-1/3 bg-warm-sand rounded mb-2" />
            <div className="h-3 w-1/4 bg-warm-sand rounded mb-1" />
            <div className="h-3 w-2/5 bg-warm-sand rounded" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
