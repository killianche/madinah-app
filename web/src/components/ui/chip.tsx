import { cn } from "@/lib/cn";

export type ChipTone = "neutral" | "good" | "warn" | "bad" | "amber";
export type ChipSize = "s" | "m";

const TONES: Record<ChipTone, string> = {
  neutral:
    "bg-warm-sand text-charcoal dark:bg-[#2a2a28] dark:text-[#d6d3c7]",
  good:
    "bg-[rgba(63,107,61,0.10)] text-moss dark:bg-[rgba(109,167,107,0.14)] dark:text-[#8db589]",
  warn:
    "bg-[rgba(201,100,66,0.10)] text-terracotta dark:bg-[rgba(201,100,66,0.16)] dark:text-[#d98669]",
  bad:
    "bg-[rgba(181,51,51,0.10)] text-crimson dark:bg-[rgba(232,128,128,0.14)] dark:text-[#e88080]",
  amber:
    "bg-[rgba(212,145,29,0.14)] text-[#8a5a1f] dark:bg-[rgba(200,156,106,0.14)] dark:text-[#c89c6a]",
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
