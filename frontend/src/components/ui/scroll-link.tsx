"use client";

import { ChevronDown } from "lucide-react";

interface ScrollLinkProps {
  href: string;
  children: React.ReactNode;
}

export function ScrollLink({ href, children }: ScrollLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.querySelector(href);
    target?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="group inline-flex items-center gap-2 rounded-lg border border-surface-border px-8 py-3 text-base font-semibold text-heading transition-colors hover:bg-surface"
    >
      {children}
      <ChevronDown className="h-4 w-4 animate-bounce" />
    </a>
  );
}
