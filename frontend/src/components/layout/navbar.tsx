"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { BrandLogo } from "@/components/ui/brand-logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { ProfileEditModal } from "@/components/layout/profile-edit-modal";
import type { UserResponse } from "@/lib/auth";

interface NavbarProps {
  user: UserResponse;
  onUserUpdated: (user: UserResponse) => void;
}

export function Navbar({ user, onUserUpdated }: NavbarProps) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <nav className="border-b border-surface-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
