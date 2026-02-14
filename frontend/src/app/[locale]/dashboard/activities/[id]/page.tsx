"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Loader2,
  Clock,
  AlertTriangle,
  Paperclip,
  Upload,
  Trash2,
  FileText,
  Image,
  Settings,
  X,
} from "lucide-react";
import {
  getActivity,
  updateActivity,
  deleteActivity,
  uploadAttachment,
  deleteAttachment,
  type ActivityDetailResponse,
  type AttachmentResponse,
  type UpdateActivityInput,
} from "@/lib/activities";
import { checkMembership } from "@/lib/groups";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { useToast } from "@/components/ui/toast";

export default function ActivityDetailPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const activityId = params.id as string;

  const [activity, setActivity] = useState<ActivityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [groupId, setGroupId] = useState("");

  // Edit
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Attachments
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await getActivity(activityId);
      setActivity(data);
      return data;
    } catch {
      router.push("/dashboard/my-groups");
      return null;
    }
  }, [activityId, router]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchActivity();
      if (!data) return;

      // Use group_id from the activity response to check membership/admin status
      setGroupId(data.group_id);
      try {
        const m = await checkMembership(data.group_id);
        setIsGroupAdmin(m.status === "member" && m.role === "admin");
      } catch {
        // Not a member — read-only access may still work via backend permission
      }

      setLoading(false);
    }
    load();
  }, [fetchActivity]);

  function openEdit() {
    if (!activity) return;
    setEditTitle(activity.title);
    setEditDescription(activity.description ?? "");
    const d = new Date(activity.due_date);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    setEditDueDate(local.toISOString().slice(0, 16));
    setEditing(true);
  }

  async function handleSave() {
    if (!activity) return;
    setSaving(true);
    try {
      const input: UpdateActivityInput = {};
      if (editTitle !== activity.title) input.title = editTitle;
      if ((editDescription || "") !== (activity.description || ""))
        input.description = editDescription;

      const newDue = new Date(editDueDate).toISOString();
      if (newDue !== activity.due_date) input.due_date = newDue;

      await updateActivity(activityId, input);
      toast(t("ACTIVITY_UPDATE_SUCCESS"));
      setEditing(false);
      await fetchActivity();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("ACTIVITY_DELETE_CONFIRM"))) return;
    try {
      await deleteActivity(activityId);
      toast(t("ACTIVITY_DELETE_SUCCESS"));
      if (groupId) {
        router.push(`/dashboard/groups/${groupId}`);
      } else {
        router.push("/dashboard/my-groups");
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    try {
      await uploadAttachment(activityId, e.target.files[0]);
      toast(t("ACTIVITY_ATTACHMENT_UPLOAD_SUCCESS"));
      await fetchActivity();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteAttachment(fileId: string) {
    setDeletingFile(fileId);
    try {
      await deleteAttachment(activityId, fileId);
      toast(t("ACTIVITY_ATTACHMENT_DELETE_SUCCESS"));
      await fetchActivity();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setDeletingFile(null);
    }
  }

  function formatDueDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isOverdue(dateStr: string): boolean {
    return new Date(dateStr).getTime() < Date.now();
  }

  function isDueSoon(dateStr: string): boolean {
    const diff = new Date(dateStr).getTime() - Date.now();
    return diff > 0 && diff < 48 * 60 * 60 * 1000;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(contentType: string) {
    if (contentType.startsWith("image/")) {
      return <Image className="h-5 w-5 text-blue-400" />;
    }
    return <FileText className="h-5 w-5 text-secondary" />;
  }

  if (loading || !activity) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const overdue = isOverdue(activity.due_date);
  const dueSoon = isDueSoon(activity.due_date);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => {
          if (groupId) {
            router.push(`/dashboard/groups/${groupId}`);
          } else {
            router.push("/dashboard/my-groups");
          }
        }}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-heading transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("ACTIVITY_BACK_TO_GROUP")}
      </button>

      {/* Activity Header */}
      <div className="rounded-lg border border-surface-border bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-heading">
              {activity.title}
            </h1>
            {activity.description && (
              <p className="mt-2 text-sm text-muted whitespace-pre-wrap">
                {activity.description}
              </p>
            )}
          </div>
          {isGroupAdmin && (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openEdit}
                className="w-auto"
              >
                <Settings className="h-4 w-4" />
                {t("GROUP_EDIT_BUTTON")}
              </Button>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-surface-border p-2 text-red-400 hover:bg-red-600/10 hover:border-red-400/40 transition-colors"
                title={t("ACTIVITY_DELETE_BUTTON")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {overdue ? (
            <>
              <AlertTriangle className="h-4 w-4 text-error" />
              <span className="text-sm font-medium text-error">
                {t("ACTIVITY_OVERDUE")} — {formatDueDate(activity.due_date)}
              </span>
            </>
          ) : dueSoon ? (
            <>
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-warning">
                {formatDueDate(activity.due_date)}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">
                {formatDueDate(activity.due_date)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Attachments */}
      <div className="rounded-lg border border-surface-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
            <Paperclip className="h-5 w-5 text-secondary" />
            {t("ACTIVITY_ATTACHMENTS_TITLE")}
          </h2>
          {isGroupAdmin && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <span className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors">
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {t("ACTIVITY_UPLOAD_ATTACHMENT")}
              </span>
            </label>
          )}
        </div>

        {activity.attachments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {t("ACTIVITY_ATTACHMENTS_EMPTY")}
          </p>
        ) : (
          <div className="space-y-2">
            {activity.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between rounded-lg border border-surface-border bg-background p-3"
              >
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3 hover:text-secondary transition-colors"
                >
                  {getFileIcon(att.content_type)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading truncate">
                      {att.filename}
                    </p>
                    <p className="text-xs text-muted">
                      {formatFileSize(att.size_bytes)}
                    </p>
                  </div>
                </a>
                {isGroupAdmin && (
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    disabled={deletingFile === att.id}
                    className="ml-3 shrink-0 rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50"
                    title={t("ACTIVITY_DELETE_BUTTON")}
                  >
                    {deletingFile === att.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-background p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-heading">
                {t("ACTIVITY_EDIT_TITLE")}
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
                label={t("ACTIVITY_TITLE_LABEL")}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t("ACTIVITY_TITLE_PLACEHOLDER")}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-body">
                  {t("ACTIVITY_DESCRIPTION_LABEL")}
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={t("ACTIVITY_DESCRIPTION_PLACEHOLDER")}
                  rows={3}
                  className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body placeholder-muted outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-body">
                  {t("ACTIVITY_DUE_DATE_LABEL")}
                </label>
                <input
                  type="datetime-local"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body outline-none focus:border-secondary [color-scheme:dark]"
                />
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
    </div>
  );
}
