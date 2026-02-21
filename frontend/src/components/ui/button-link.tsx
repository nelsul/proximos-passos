import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/routing";

type ButtonVariant = "primary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-secondary-dark via-secondary to-secondary-light text-white shadow-[0_2px_12px_rgba(207,161,86,0.3)] hover:shadow-[0_4px_20px_rgba(207,161,86,0.5)] hover:brightness-110",
  outline:
    "border border-surface-border text-heading hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-5 py-2 text-sm",
  md: "px-8 py-3 text-base",
  lg: "px-10 py-4 text-lg",
};

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon: Icon,
  children,
  className = "",
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-lg font-semibold tracking-wide uppercase transition-all duration-200 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
    >
      {children}
      {Icon && <Icon className="h-4 w-4" />}
    </Link>
  );
}
