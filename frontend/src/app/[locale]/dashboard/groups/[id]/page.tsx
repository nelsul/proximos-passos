"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Loader2,
  Users,
  Globe,
  Lock,
  DoorOpen,
  DoorClosed,
  Shield,
  Settings,
  UserMinus,
  Check,
  X,
  Upload,
  Trash2,
  Share2,
  CalendarClock,
  History,
  Info,
} from "lucide-react";
import {
  getGroup,
  updateGroup,
  uploadGroupThumbnail,
  deleteGroupThumbnail,
  listGroupMembers,
  listPendingMembers,
  approveMember,
  rejectMember,
  removeMember,
  checkMembership,
  updateMemberRoleAsGroupAdmin,
  type GroupResponse,
  type GroupMemberResponse,
  type MembershipStatus,
  type UpdateGroupInput,
} from "@/lib/groups";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { InviteGroupModal } from "@/components/groups/invite-group-modal";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { UpcomingActivities } from "@/components/activities/upcoming-activities";
import { PastActivities } from "@/components/activities/past-activities";

type Tab = "details" | "activities" | "past" | "members";

const MEMBERS_PAGE_SIZE = 10;
const PENDING_PAGE_SIZE = 10;

export default function GroupDetailPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipStatus>("none");
  const [userRole, setUserRole] = useState<string>("");

  // Members
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [membersPage, setMembersPage] = useState(1);
  const [membersTotalPages, setMembersTotalPages] = useState(1);
  const [membersLoading, setMembersLoading] = useState(true);

  // Pending members (group admin only)
  const [pending, setPending] = useState<GroupMemberResponse[]>([]);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAccess, setEditAccess] = useState<"open" | "closed">("closed");
  const [editVisibility, setEditVisibility] = useState<"public" | "private">(
    "private",
  );
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [thumbCropSrc, setThumbCropSrc] = useState<string | null>(null);
  const thumbFileInputRef = useRef<HTMLInputElement>(null);
  const [showInvite, setShowInvite] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());
  const [thumbError, setThumbError] = useState(false);

  const isGroupAdmin = membership === "member" && userRole === "admin";
  const [activeTab, setActiveTab] = useState<Tab>("activities");

  // Fetch group
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [g, m] = await Promise.all([
          getGroup(groupId),
          checkMembership(groupId),
        ]);
        setGroup(g);
        setMembership(m.status);
        setUserRole(m.role ?? "");
      } catch {
        router.push("/dashboard/my-groups");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [groupId, router]);

  // Fetch members
  const fetchMembers = useCallback(
    async (p: number) => {
      setMembersLoading(true);
      try {
        const res = await listGroupMembers(groupId, p, MEMBERS_PAGE_SIZE);
        setMembers(res.data);
        setMembersTotalPages(res.total_pages);
      } finally {
        setMembersLoading(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    fetchMembers(membersPage);
  }, [membersPage, fetchMembers]);

  // Fetch pending members (group admin only)
  const fetchPending = useCallback(
    async (p: number) => {
      if (!isGroupAdmin) return;
      setPendingLoading(true);
      try {
        const res = await listPendingMembers(groupId, p, PENDING_PAGE_SIZE);
        setPending(res.data);
        setPendingTotalPages(res.total_pages);
        setPendingTotal(res.total_items);
      } finally {
        setPendingLoading(false);
      }
    },
    [groupId, isGroupAdmin],
  );

  useEffect(() => {
    fetchPending(pendingPage);
  }, [pendingPage, fetchPending]);

  // Edit helpers
  function openEdit() {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditAccess(group.access_type);
    setEditVisibility(group.visibility_type);
    setEditing(true);
  }

  async function handleSave() {
    if (!group) return;
    setSaving(true);
    try {
      const input: UpdateGroupInput = {};
      if (editName !== group.name) input.name = editName;
      if ((editDescription || "") !== (group.description || ""))
        input.description = editDescription;
      if (editAccess !== group.access_type) input.access_type = editAccess;
      if (editVisibility !== group.visibility_type)
        input.visibility_type = editVisibility;

      const updated = await updateGroup(group.id, input);
      setGroup(updated);
      setEditing(false);
      toast(t("GROUP_UPDATE_SUCCESS"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!group || !file) return;
    if (thumbFileInputRef.current) thumbFileInputRef.current.value = "";
    setThumbCropSrc(URL.createObjectURL(file));
  }

  async function handleThumbCropComplete(croppedFile: File) {
    if (!group) return;
    if (thumbCropSrc) URL.revokeObjectURL(thumbCropSrc);
    setThumbCropSrc(null);
    setUploadingThumb(true);
    try {
      const updated = await uploadGroupThumbnail(group.id, croppedFile);
      setGroup(updated);
      toast(t("GROUP_THUMBNAIL_UPLOAD_SUCCESS"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setUploadingThumb(false);
    }
  }

  function handleThumbCropCancel() {
    if (thumbCropSrc) URL.revokeObjectURL(thumbCropSrc);
    setThumbCropSrc(null);
  }

  async function handleThumbnailDelete() {
    if (!group) return;
    setUploadingThumb(true);
    try {
      const updated = await deleteGroupThumbnail(group.id);
      setGroup(updated);
      toast(t("GROUP_THUMBNAIL_DELETE_SUCCESS"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setUploadingThumb(false);
    }
  }

  async function handleApprove(userId: string) {
    setActionLoading(userId);
    try {
      await approveMember(groupId, userId);
      toast(t("GROUP_MEMBER_APPROVED"));
      fetchPending(pendingPage);
      fetchMembers(membersPage);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(userId: string) {
    setActionLoading(userId);
    try {
      await rejectMember(groupId, userId);
      toast(t("GROUP_MEMBER_REJECTED"));
      fetchPending(pendingPage);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    setActionLoading(userId);
    try {
      await removeMember(groupId, userId);
      toast(t("GROUP_MEMBER_REMOVED"));
      fetchMembers(membersPage);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRoleChange(userId: string, currentRole: string, newRole: "admin" | "supervisor" | "member") {
    if (currentRole === newRole) return;
    setActionLoading(userId);
    try {
      await updateMemberRoleAsGroupAdmin(groupId, userId, newRole);
      toast(t("GROUP_MEMBER_ROLE_UPDATED"));
      fetchMembers(membersPage);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !group) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    ...(isGroupAdmin
      ? [
          {
            key: "details" as Tab,
            label: t("GROUP_TAB_DETAILS"),
            icon: <Info className="h-4 w-4" />,
          },
        ]
      : []),
    {
      key: "activities",
      label: t("GROUP_TAB_ACTIVITIES"),
      icon: <CalendarClock className="h-4 w-4" />,
    },
    {
      key: "past",
      label: t("GROUP_TAB_PAST_ACTIVITIES"),
      icon: <History className="h-4 w-4" />,
    },
    {
      key: "members",
      label: t("GROUP_TAB_MEMBERS"),
      icon: <Users className="h-4 w-4" />,
    },
  ];

  return (
    <>
      {thumbCropSrc && (
        <ImageCropModal
          imageSrc={thumbCropSrc}
          aspectRatio={16 / 9}
          maxWidth={800}
          onCropComplete={handleThumbCropComplete}
          onCancel={handleThumbCropCancel}
        />
      )}
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard/my-groups")}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-heading transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("GROUP_BACK_TO_MY_GROUPS")}
        </button>

        {/* Group Header */}
        <div className="rounded-lg border border-surface-border bg-surface p-6">
          <div className="flex items-start gap-5">
            {group.thumbnail_url && !thumbError ? (
              <img
                src={group.thumbnail_url}
                alt={group.name}
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
                onError={() => setThumbError(true)}
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-secondary/15">
                <Users className="h-10 w-10 text-secondary" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-heading">
                    {group.name}
                  </h1>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted">
                      {group.description}
                    </p>
                  )}
                </div>

                {isGroupAdmin && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInvite(true)}
                      className="w-auto shrink-0"
                    >
                      <Share2 className="h-4 w-4" />
                      {t("GROUP_INVITE_BUTTON")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openEdit}
                      className="w-auto shrink-0"
                    >
                      <Settings className="h-4 w-4" />
                      {t("GROUP_EDIT_BUTTON")}
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
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

          {/* Thumbnail management for admin */}
          {isGroupAdmin && (
            <div className="mt-4 flex items-center gap-3 border-t border-surface-border pt-4">
              <label className="cursor-pointer">
                <input
                  ref={thumbFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleThumbnailUpload}
                  disabled={uploadingThumb}
                />
                <span className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors">
                  {uploadingThumb ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {t("GROUP_UPLOAD_THUMBNAIL")}
                </span>
              </label>
              {group.thumbnail_url && (
                <button
                  onClick={handleThumbnailDelete}
                  disabled={uploadingThumb}
                  className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:border-red-400/40 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("GROUP_DELETE_THUMBNAIL")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-surface-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-secondary text-secondary"
                  : "border-transparent text-muted hover:text-heading hover:border-surface-border"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {/* Edit Group Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-surface-border bg-background p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-heading">
                  {t("GROUP_EDIT_TITLE")}
                </h2>
                <button
                  onClick={() => setEditing(false)}
                  className="text-muted hover:text-heading"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <InputField
                  label={t("GROUP_NAME_LABEL")}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("GROUP_NAME_PLACEHOLDER")}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-body">
                    {t("GROUP_DESCRIPTION_LABEL")}
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t("GROUP_DESCRIPTION_PLACEHOLDER")}
                    rows={3}
                    className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body placeholder-muted outline-none focus:border-secondary"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-body">
                    {t("GROUP_ACCESS_LABEL")}
                  </label>
                  <select
                    value={editAccess}
                    onChange={(e) =>
                      setEditAccess(e.target.value as "open" | "closed")
                    }
                    className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body outline-none focus:border-secondary"
                  >
                    <option value="open">{t("GROUP_ACCESS_OPEN")}</option>
                    <option value="closed">{t("GROUP_ACCESS_CLOSED")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-body">
                    {t("GROUP_VISIBILITY_LABEL")}
                  </label>
                  <select
                    value={editVisibility}
                    onChange={(e) =>
                      setEditVisibility(e.target.value as "public" | "private")
                    }
                    className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body outline-none focus:border-secondary"
                  >
                    <option value="public">
                      {t("GROUP_VISIBILITY_PUBLIC")}
                    </option>
                    <option value="private">
                      {t("GROUP_VISIBILITY_PRIVATE")}
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  className="flex-1"
                >
                  {t("PROFILE_CANCEL")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  loading={saving}
                  className="flex-1"
                >
                  {t("PROFILE_SAVE")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInvite && group && (
          <InviteGroupModal
            groupId={group.id}
            groupName={group.name}
            onClose={() => setShowInvite(false)}
          />
        )}

        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Pending Members (group admin only) */}
            {isGroupAdmin && pendingTotal > 0 && (
              <div className="rounded-lg border border-surface-border bg-surface p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-heading">
                  <Shield className="h-5 w-5 text-secondary" />
                  {t("GROUP_PENDING_TITLE")} ({pendingTotal})
                </h2>

                {pendingLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {pending.map((m) => (
                        <div
                          key={m.user_id}
                          className="flex items-center justify-between rounded-lg border border-surface-border bg-background p-3"
                        >
                          <div className="flex items-center gap-3">
                            {m.avatar_url && !avatarErrors.has(m.user_id) ? (
                              <img
                                src={m.avatar_url}
                                alt={m.name}
                                className="h-9 w-9 rounded-full object-cover"
                                onError={() => setAvatarErrors((prev) => new Set(prev).add(m.user_id))}
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 text-sm font-medium text-secondary">
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-medium text-heading">
                              {m.name}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(m.user_id)}
                              disabled={actionLoading === m.user_id}
                              className="rounded-lg bg-green-600/20 p-1.5 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                              title={t("GROUP_APPROVE_BUTTON")}
                            >
                              {actionLoading === m.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(m.user_id)}
                              disabled={actionLoading === m.user_id}
                              className="rounded-lg bg-red-600/20 p-1.5 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                              title={t("GROUP_REJECT_BUTTON")}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Pagination
                      page={pendingPage}
                      totalPages={pendingTotalPages}
                      onPageChange={setPendingPage}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "activities" && (
          <div className="rounded-lg border border-surface-border bg-surface p-6">
            <UpcomingActivities groupId={groupId} isGroupAdmin={isGroupAdmin} />
          </div>
        )}

        {activeTab === "past" && (
          <div className="rounded-lg border border-surface-border bg-surface p-6">
            <PastActivities groupId={groupId} />
          </div>
        )}

        {activeTab === "members" && (
          <div className="rounded-lg border border-surface-border bg-surface p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-heading">
              <Users className="h-5 w-5 text-secondary" />
              {t("GROUP_DETAIL_MEMBERS")}
            </h2>

            {membersLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" />
              </div>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                {t("GROUP_DETAIL_NO_MEMBERS")}
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {members.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between rounded-lg border border-surface-border bg-background p-3"
                    >
                      <div className="flex items-center gap-3">
                        {m.avatar_url && !avatarErrors.has(m.user_id) ? (
                          <img
                            src={m.avatar_url}
                            alt={m.name}
                            className="h-9 w-9 rounded-full object-cover"
                            onError={() => setAvatarErrors((prev) => new Set(prev).add(m.user_id))}
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 text-sm font-medium text-secondary">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-heading">
                            {m.name}
                          </span>
                          {!isGroupAdmin && m.role === "admin" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary">
                              <Shield className="h-3 w-3" />
                              {t("GROUP_DETAIL_ROLE_ADMIN")}
                            </span>
                          )}
                          {!isGroupAdmin && m.role === "supervisor" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                              <Users className="h-3 w-3" />
                              {t("GROUP_DETAIL_ROLE_SUPERVISOR")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Admin role select and remove button */}
                      {isGroupAdmin && (
                        <div className="flex items-center gap-2">
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.user_id, m.role, e.target.value as "admin" | "supervisor" | "member")}
                            disabled={actionLoading === m.user_id || m.role === "admin"}
                            className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-body outline-none focus:border-secondary disabled:opacity-50"
                          >
                            <option value="member">{t("GROUP_DETAIL_ROLE_MEMBER")}</option>
                            <option value="supervisor">{t("GROUP_DETAIL_ROLE_SUPERVISOR")}</option>
                            <option value="admin">{t("GROUP_DETAIL_ROLE_ADMIN")}</option>
                          </select>
                          
                          {m.role !== "admin" && (
                            <button
                              onClick={() => handleRemoveMember(m.user_id)}
                              disabled={actionLoading === m.user_id}
                              className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50"
                              title={t("GROUP_REMOVE_MEMBER_BUTTON")}
                            >
                              {actionLoading === m.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserMinus className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination
                  page={membersPage}
                  totalPages={membersTotalPages}
                  onPageChange={setMembersPage}
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
