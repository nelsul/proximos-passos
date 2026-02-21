"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, UserCog, Pencil } from "lucide-react";
import { listUsers, type UserResponse } from "@/lib/users";
import { EditUserModal } from "@/components/users/edit-user-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function UsersPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [search, setSearch] = useState("");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await listUsers(pageNum, 20);
      setUsers(res.data ?? []);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page);
  }, [page, fetchUsers]);

  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  function handleUpdated() {
    setEditingUser(null);
    toast(t("USER_UPDATE_SUCCESS"));
    fetchUsers(page);
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-heading">{t("USERS_TITLE")}</h1>
        <p className="mt-1 text-sm text-muted">{t("USERS_SUBTITLE")}</p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("USER_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <UserCog className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("USERS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface p-4 transition-colors hover:bg-surface-light"
              >
                {user.avatar_url && !imgErrors.has(user.id) ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                    onError={() => setImgErrors((prev) => new Set(prev).add(user.id))}
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary">
                    {getInitials(user.name)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-heading">{user.name}</h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {user.role === "admin"
                        ? t("USER_ROLE_ADMIN")
                        : t("USER_ROLE_REGULAR")}
                    </span>
                    {!user.is_active && (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        {t("USER_INACTIVE")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{user.email}</p>
                </div>

                <button
                  onClick={() => setEditingUser(user)}
                  className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("HANDOUT_PAGE_PREV")}
              </Button>
              <span className="text-sm text-muted">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("HANDOUT_PAGE_NEXT")}
              </Button>
            </div>
          )}
        </>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
