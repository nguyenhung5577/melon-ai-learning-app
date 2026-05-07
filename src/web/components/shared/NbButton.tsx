"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface NbButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-nb-black text-white [box-shadow:6px_6px_0_var(--nb-orange)] hover:bg-nb-orange hover:text-nb-black hover:[box-shadow:9px_9px_0_var(--nb-black)]",
  secondary:
    "bg-nb-yellow text-nb-black [box-shadow:5px_5px_0_var(--nb-black)] hover:[box-shadow:8px_8px_0_var(--nb-black)]",
  ghost:
    "bg-white text-nb-black [box-shadow:4px_4px_0_var(--nb-black)] hover:[box-shadow:6px_6px_0_var(--nb-black)]",
  danger:
    "bg-nb-pink text-nb-black [box-shadow:4px_4px_0_var(--nb-black)] hover:bg-nb-red hover:text-white hover:[box-shadow:6px_6px_0_var(--nb-black)]",
  outline:
    "bg-transparent text-nb-black [box-shadow:none] hover:bg-nb-yellow hover:[box-shadow:4px_4px_0_var(--nb-black)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[0.65rem]",
  md: "px-5 py-2.5 text-[0.75rem]",
  lg: "px-7 py-3.5 text-[0.875rem]",
};

export const NbButton = forwardRef<HTMLButtonElement, NbButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "font-display [border:var(--nb-border)] cursor-pointer",
          "transition-all duration-150 ease-out",
          "hover:-translate-x-0.5 hover:-translate-y-0.5",
          "active:translate-x-0.5 active:translate-y-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nb-orange",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {icon && iconPosition === "left" && icon}
            {children}
            {icon && iconPosition === "right" && icon}
          </>
        )}
      </button>
    );
  }
);

NbButton.displayName = "NbButton";
