export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full bg-warm-sand text-charcoal font-serif font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.43 }}
    >
      {initial}
    </div>
  );
}
