import { cn } from "@/lib/cn";

export type ChipTone = "neutral" | "good" | "warn" | "bad";
export type ChipSize = "s" | "m";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-warm-sand text-charcoal",
  good: "bg-[rgba(63,107,61,0.10)] text-moss",
  warn: "bg-[rgba(201,100,66,0.10)] text-terracotta",
  bad: "bg-[rgba(181,51,51,0.10)] text-crimson",
};

const SIZES: Record<ChipSize, string> = {
  s: "text-[11px] px-[7px] py-[3px]",
  m: "text-[12px] px-[9px] py-[5px]",
};

export function Chip({
  tone = "neutral",
  size = "m",
  children,
  className,
}: {
  tone?: ChipTone;
  size?: ChipSize;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium leading-none whitespace-nowrap",
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
