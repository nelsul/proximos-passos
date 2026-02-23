"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Users,
  Globe,
  Lock,
  DoorOpen,
  DoorClosed,
  Shield,
  LogIn,
  ArrowLeft,
} from "lucide-react";
import {
  getGroupPreview,
  listGroupMembers,
  joinGroup,
  checkMembership,
  type GroupResponse,
  type GroupMemberResponse,
  type MembershipStatus,
} from "@/lib/groups";
import { ApiRequestError } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const MEMBERS_PAGE_SIZE = 10;

export default function JoinGroupPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [membership, setMembership] = useState<MembershipStatus>("none");
  const [joining, setJoining] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [thumbError, setThumbError] = useState(false);

  // Fetch group preview
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [g, m] = await Promise.all([
          getGroupPreview(groupId),
          checkMembership(groupId),
        ]);
        setGroup(g);
        setMembership(m.status);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [groupId]);

  // Closed groups → show only admins; open groups → show all
  const roleFilter = group?.access_type === "closed" ? "admin" : undefined;

  const fetchMembers = useCallback(
    async (p: number) => {
      setMembersLoading(true);
      try {
        const res = await listGroupMembers(
          groupId,
          p,
          MEMBERS_PAGE_SIZE,
          roleFilter,
        );
        setMembers(res.data);
        setTotalPages(res.total_pages);
        setTotalItems(res.total_items);
      } catch {
        // Members may not be accessible for private groups — that's fine
      } finally {
        setMembersLoading(false);
      }
    },
    [groupId, roleFilter],
  );

  useEffect(() => {
    if (group) fetchMembers(page);
  }, [page, group, fetchMembers]);

  const joinDisabled = membership === "pending";

  async function handleJoin() {
    if (membership === "member") {
      router.push(`/dashboard/groups/${groupId}`);
      return;
    }

    setJoining(true);
    try {
      const res = await joinGroup(groupId);
      if (res.status === "accepted") {
        toast(t("GROUP_JOIN_SUCCESS"));
        router.push(`/dashboard/groups/${groupId}`);
      } else {
        toast(t("GROUP_REQUEST_SUCCESS"));
        setMembership("pending");
      }
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <p className="text-muted">{t("GROUP_NOT_FOUND")}</p>
          <button
            onClick={() => router.push("/dashboard/my-groups")}
            className="mt-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary-dark transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("GROUP_BACK_TO_MY_GROUPS")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Group Header Card */}
      <div className="rounded-lg border border-surface-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="border-b border-surface-border px-6 py-5">
          <div className="flex items-start gap-4">
            {group.thumbnail_url && !thumbError ? (
              <img
                src={group.thumbnail_url}
                alt={group.name}
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
                onError={() => setThumbError(true)}
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary/15">
                <Users className="h-8 w-8 text-secondary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-heading">{group.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
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
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Description */}
          {group.description && (
            <p className="mb-4 text-sm text-muted">{group.description}</p>
          )}

          {/* Members section */}
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-heading">
              {group.access_type === "closed"
                ? t("GROUP_DETAIL_ADMINS")
                : t("GROUP_DETAIL_MEMBERS")}
            </h2>
            {!membersLoading && (
              <span className="text-xs text-muted">({totalItems})</span>
            )}
          </div>

          {membersLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
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
                    {member.avatar_url && !imgErrors.has(member.user_id) ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                        onError={() => setImgErrors((prev) => new Set(prev).add(member.user_id))}
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
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
