import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-md bg-ivory px-3 py-2 text-sm text-near-black",
        "placeholder:text-olive-gray-light shadow-ring",
        "focus:shadow-focus focus:outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-sm font-medium text-near-black mb-1.5", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-terracotta mt-1">{error}</p>
      ) : helper ? (
        <p className="text-xs text-olive-gray mt-1">{helper}</p>
      ) : null}
    </div>
  );
}
