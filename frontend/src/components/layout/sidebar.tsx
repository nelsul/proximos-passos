"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import { Users, BookOpen, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/groups", icon: Users, labelKey: "SIDEBAR_GROUPS" },
  {
    href: "/dashboard/my-groups",
    icon: BookOpen,
    labelKey: "SIDEBAR_MY_GROUPS",
  },
] as const;

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  const navContent = (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onMobileClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-secondary/15 text-secondary"
                  : "text-body hover:bg-surface-light hover:text-heading"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-surface-border bg-surface p-4 pt-20 transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={onMobileClose}
          className="absolute right-3 top-4 rounded-lg p-1 text-muted hover:text-heading"
        >
          <X className="h-5 w-5" />
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-60 lg:shrink-0">
        <div className="sticky top-20 rounded-lg border border-surface-border bg-surface p-3">
          {navContent}
        </div>
      </aside>
    </>
  );
}
