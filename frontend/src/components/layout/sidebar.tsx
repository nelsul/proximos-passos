"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import {
  Users,
  UserCog,
  BookOpen,
  Layers,
  FileText,
  Video,
  ListChecks,
  HelpCircle,
  Building2,
  GraduationCap,
  ClipboardList,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: typeof Users;
  labelKey: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/groups", icon: Users, labelKey: "SIDEBAR_GROUPS" },
  {
    href: "/dashboard/my-groups",
    icon: BookOpen,
    labelKey: "SIDEBAR_MY_GROUPS",
  },
  {
    href: "/dashboard/topics",
    icon: Layers,
    labelKey: "SIDEBAR_TOPICS",
  },
  {
    href: "/dashboard/handouts",
    icon: FileText,
    labelKey: "SIDEBAR_HANDOUTS",
  },
  {
    href: "/dashboard/video-lessons",
    icon: Video,
    labelKey: "SIDEBAR_VIDEO_LESSONS",
  },
  {
    href: "/dashboard/exercise-lists",
    icon: ListChecks,
    labelKey: "SIDEBAR_EXERCISE_LISTS",
  },
  {
    href: "/dashboard/questions",
    icon: HelpCircle,
    labelKey: "SIDEBAR_QUESTIONS",
  },
  {
    href: "/dashboard/submissions",
    icon: ClipboardList,
    labelKey: "SIDEBAR_SUBMISSIONS",
  },
  {
    href: "/dashboard/institutions",
    icon: Building2,
    labelKey: "SIDEBAR_INSTITUTIONS",
  },
  {
    href: "/dashboard/exams",
    icon: GraduationCap,
    labelKey: "SIDEBAR_EXAMS",
  },
  {
    href: "/dashboard/users",
    icon: UserCog,
    labelKey: "SIDEBAR_USERS",
    adminOnly: true,
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userRole?: string;
}

export function Sidebar({ mobileOpen, onMobileClose, userRole }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || userRole === "admin",
  );

  const navContent = (
    <ul className="space-y-1">
      {visibleItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
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
