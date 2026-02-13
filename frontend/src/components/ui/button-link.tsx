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
    "bg-secondary text-white shadow-lg hover:bg-secondary-dark hover:shadow-xl",
  outline: "border border-surface-border text-heading hover:bg-surface",
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
      className={`inline-flex items-center gap-2 rounded-lg font-semibold transition-all ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
    >
      {children}
      {Icon && <Icon className="h-4 w-4" />}
    </Link>
  );
}
