"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { ProfileEditModal } from "@/components/layout/profile-edit-modal";
import type { UserResponse } from "@/lib/auth";

interface NavbarProps {
  user: UserResponse;
  onUserUpdated: (user: UserResponse) => void;
  onMenuToggle?: () => void;
}

export function Navbar({ user, onUserUpdated, onMenuToggle }: NavbarProps) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-surface-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading lg:hidden"
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <Link href="/dashboard" className="shrink-0">
              <div className="flex items-center gap-2">
                <BrandLogo
                  variant="icon"
                  size="md"
                  priority
                  className="hidden sm:block"
                />
                <BrandLogo
                  variant="icon"
                  size="sm"
                  priority
                  className="sm:hidden"
                />
                <div className="mt-1 hidden min-[420px]:block">
                  <BrandLogo variant="title" size="md" priority />
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserMenu user={user} onEditProfile={() => setShowProfile(true)} />
          </div>
        </div>
      </nav>

      {showProfile && (
        <ProfileEditModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={(updated) => {
            onUserUpdated(updated);
            setShowProfile(false);
          }}
        />
      )}
    </>
  );
}
