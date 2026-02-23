"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { getMe, type UserResponse } from "@/lib/auth";
import { UserProvider } from "@/contexts/user-context";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar
        user={user}
        onUserUpdated={setUser}
        onMenuToggle={() => setSidebarOpen((prev) => !prev)}
      />
      <div className="mx-auto flex w-full max-w-[1920px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          userRole={user.role}
        />
        <main className="min-w-0 flex-1">
          <UserProvider role={user.role}>{children}</UserProvider>
        </main>
      </div>
    </div>
  );
}
