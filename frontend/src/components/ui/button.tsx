"use client";

import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-secondary-dark via-secondary to-secondary-light text-white shadow-[0_2px_12px_rgba(207,161,86,0.3)] hover:shadow-[0_4px_20px_rgba(207,161,86,0.5)] hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:brightness-100",
  outline:
    "border border-surface-border text-heading hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:border-surface-border disabled:hover:text-heading disabled:hover:bg-transparent",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 sm:px-5 py-2 text-xs sm:text-sm",
  md: "px-4 sm:px-8 py-2.5 text-sm sm:text-base",
  lg: "px-6 sm:px-10 py-3 text-base sm:text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`relative inline-flex w-full items-center justify-center rounded-lg font-semibold tracking-wide uppercase transition-all duration-200 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="absolute h-5 w-5 animate-spin" />}
      <span className={`inline-flex items-center gap-2 transition-opacity duration-200 ${loading ? "opacity-0" : "opacity-100"}`}>
        {children}
      </span>
    </button>
  );
}
