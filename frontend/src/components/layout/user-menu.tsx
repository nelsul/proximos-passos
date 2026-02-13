"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { LogOut, User, ChevronDown } from "lucide-react";
import { logout, type UserResponse } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

interface UserMenuProps {
  user: UserResponse;
  onEditProfile: () => void;
}

export function UserMenu({ user, onEditProfile }: UserMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await logout();
      toast(t("LOGOUT_SUCCESS"));
    } finally {
      router.push("/login");
    }
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-light"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-white">
            {initials}
          </span>
        )}
        <span className="hidden text-sm font-medium text-heading sm:block">
          {user.name}
        </span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-surface-border bg-surface shadow-xl">
          <div className="border-b border-surface-border px-4 py-3">
            <p className="text-sm font-medium text-heading">{user.name}</p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                onEditProfile();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-body transition-colors hover:bg-surface-light hover:text-heading"
            >
              <User className="h-4 w-4" />
              {t("MENU_EDIT_PROFILE")}
            </button>

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error transition-colors hover:bg-surface-light"
            >
              <LogOut className="h-4 w-4" />
              {t("MENU_LOGOUT")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
