"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Users,
  Globe,
  Lock,
  DoorOpen,
  DoorClosed,
  Loader2,
  Shield,
  LogIn,
} from "lucide-react";
import type {
  GroupResponse,
  GroupMemberResponse,
  MembershipStatus,
} from "@/lib/groups";
import { listGroupMembers, joinGroup, checkMembership } from "@/lib/groups";
import { ApiRequestError } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface GroupDetailModalProps {
  group: GroupResponse;
  onClose: () => void;
}

const MEMBERS_PAGE_SIZE = 10;

export function GroupDetailModal({ group, onClose }: GroupDetailModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [membership, setMembership] = useState<MembershipStatus>("none");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [groupImgError, setGroupImgError] = useState(false);

  // Closed groups → show only admins; open groups → show all
  const roleFilter = group.access_type === "closed" ? "admin" : undefined;

  const fetchMembers = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await listGroupMembers(
          group.id,
          p,
          MEMBERS_PAGE_SIZE,
          roleFilter,
        );
        setMembers(res.data);
        setTotalPages(res.total_pages);
        setTotalItems(res.total_items);
      } finally {
        setLoading(false);
      }
    },
    [group.id, roleFilter],
  );

  useEffect(() => {
    fetchMembers(page);
  }, [page, fetchMembers]);

  useEffect(() => {
    checkMembership(group.id).then((res) => setMembership(res.status));
  }, [group.id]);

  const joinDisabled = membership === "pending";

  async function handleJoin() {
    if (membership === "member") {
      router.push(`/${locale}/dashboard/groups/${group.id}`);
      onClose();
      return;
    }

    setJoining(true);
    try {
      const res = await joinGroup(group.id);
      if (res.status === "accepted") {
        toast(t("GROUP_JOIN_SUCCESS"));
      } else {
        toast(t("GROUP_REQUEST_SUCCESS"));
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(
          t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
            defaultValue: err.message,
          }),
          "error",
        );
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-surface-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-surface-border px-6 py-4">
          <div className="flex items-start gap-4 pr-2">
            {group.thumbnail_url && !groupImgError ? (
              <img
                src={group.thumbnail_url}
                alt={group.name}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                onError={() => setGroupImgError(true)}
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-secondary/15">
                <Users className="h-7 w-7 text-secondary" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-heading">
                {group.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-light px-2.5 py-0.5 text-xs font-medium text-body">
                  {group.visibility_type === "public" ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {group.visibility_type === "public"
                    ? t("GROUP_VISIBILITY_PUBLIC")
                    : t("GROUP_VISIBILITY_PRIVATE")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-light px-2.5 py-0.5 text-xs font-medium text-body">
                  {group.access_type === "open" ? (
                    <DoorOpen className="h-3 w-3" />
                  ) : (
                    <DoorClosed className="h-3 w-3" />
                  )}
                  {group.access_type === "open"
                    ? t("GROUP_ACCESS_OPEN")
                    : t("GROUP_ACCESS_CLOSED")}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Description */}
          {group.description && (
            <p className="mb-4 text-sm text-muted">{group.description}</p>
          )}

          {/* Members section */}
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-heading">
              {group.access_type === "closed"
                ? t("GROUP_DETAIL_ADMINS")
                : t("GROUP_DETAIL_MEMBERS")}
            </h3>
            {!loading && (
              <span className="text-xs text-muted">({totalItems})</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("GROUP_DETAIL_NO_MEMBERS")}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-surface-border">
                {members.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center gap-3 py-3"
                  >
                    {member.avatar_url && (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    )}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary ${member.avatar_url ? "hidden" : ""}`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">
                        {member.name}
                      </p>
                    </div>
                    {member.role === "admin" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary">
                        <Shield className="h-3 w-3" />
                        {t("GROUP_DETAIL_ROLE_ADMIN")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
          {/* Join button */}
          <div className="mt-4 border-t border-surface-border pt-4">
            <Button
              size="sm"
              loading={joining}
              disabled={joinDisabled}
              onClick={handleJoin}
              className="w-full"
            >
              <LogIn className="h-4 w-4" />
              {membership === "member"
                ? t("GROUP_GO_TO_PAGE_BUTTON")
                : membership === "pending"
                  ? t("GROUP_REQUEST_PENDING")
                  : group.access_type === "open"
                    ? t("GROUP_JOIN_BUTTON")
                    : t("GROUP_REQUEST_BUTTON")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
