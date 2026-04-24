import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "transition-[background-color,box-shadow,transform] " +
    "active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-terracotta text-ivory hover:bg-terracotta-hover active:bg-terracotta-active",
        secondary: "bg-ivory text-near-black shadow-ring hover:bg-white hover:shadow-ring-strong",
        ghost: "text-olive-gray hover:text-near-black hover:bg-subtle/60",
        danger: "bg-ivory text-near-black shadow-ring hover:shadow-ring-strong hover:text-terracotta",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, fullWidth }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
