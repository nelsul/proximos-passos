"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Loader2,
  Clock,
  Paperclip,
  Upload,
  Trash2,
  FileText,
  Image,
  Settings,
  X,
  Send,
  CheckCircle2,
  XCircle,
  ClockIcon,
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
import {
  getMyActivitySubmission,
  submitActivity,
  updateActivitySubmissionNotes,
  resubmitActivitySubmission,
  listSubmissionAttachments,
  uploadSubmissionAttachment,
  deleteSubmissionAttachment,
  type ActivitySubmissionResponse,
  type SubmissionAttachmentResponse,
} from "@/lib/activity-submissions";
import { checkMembership } from "@/lib/groups";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { LatexText } from "@/components/ui/latex-text";
import { useToast } from "@/components/ui/toast";
import { ActivityItems } from "@/components/activities/activity-items";
import { ActivitySubmissions } from "@/components/activities/activity-submissions";

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

  // Submission
  const [submission, setSubmission] =
    useState<ActivitySubmissionResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [editingSubNotes, setEditingSubNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [subAttachments, setSubAttachments] = useState<
    SubmissionAttachmentResponse[]
  >([]);
  const [uploadingSubFile, setUploadingSubFile] = useState(false);
  const [deletingSubFile, setDeletingSubFile] = useState<string | null>(null);

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

      // Load user's submission status
      try {
        const sub = await getMyActivitySubmission(activityId);
        if (sub) {
          setSubmission(sub);
          setEditingSubNotes(sub.notes ?? "");
          // Load submission attachments
          try {
            const atts = await listSubmissionAttachments(sub.id);
            setSubAttachments(atts ?? []);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore — user may not have submitted yet
      }

      setLoading(false);
    }
    load();
  }, [fetchActivity, activityId]);

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

  async function handleSaveSubNotes() {
    if (!submission || savingNotes) return;
    setSavingNotes(true);
    try {
      const updated = await updateActivitySubmissionNotes(submission.id, {
        notes: editingSubNotes.trim(),
      });
      setSubmission(updated);
      toast(t("ACTIVITY_SUBMISSION_NOTES_SAVED"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleUploadSubAttachment(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!e.target.files?.[0] || !submission) return;
    setUploadingSubFile(true);
    try {
      await uploadSubmissionAttachment(submission.id, e.target.files[0]);
      toast(t("ACTIVITY_SUBMISSION_ATTACHMENT_UPLOADED"));
      const atts = await listSubmissionAttachments(submission.id);
      setSubAttachments(atts ?? []);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setUploadingSubFile(false);
      e.target.value = "";
    }
  }

  async function handleDeleteSubAttachment(fileId: string) {
    if (!submission) return;
    setDeletingSubFile(fileId);
    try {
      await deleteSubmissionAttachment(submission.id, fileId);
      toast(t("ACTIVITY_SUBMISSION_ATTACHMENT_DELETED"));
      setSubAttachments((prev) => prev.filter((a) => a.id !== fileId));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setDeletingSubFile(null);
    }
  }

  async function handleSubmitActivity() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const sub = await submitActivity(activityId, {
        notes: submissionNotes.trim() || undefined,
      });
      setSubmission(sub);
      toast(t("ACTIVITY_SUBMISSION_SUCCESS"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResubmit() {
    if (!submission || resubmitting) return;
    setResubmitting(true);
    try {
      const updated = await resubmitActivitySubmission(submission.id);
      setSubmission(updated);
      setEditingSubNotes(updated.notes ?? "");
      toast(t("ACTIVITY_SUBMISSION_RESUBMIT_SUCCESS"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setResubmitting(false);
    }
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
      <div className="rounded-xl border border-surface-border bg-surface p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 sm:gap-6">
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-heading">
                {activity.title}
              </h1>
              {activity.description && (
                <LatexText
                  text={activity.description}
                  as="div"
                  className="mt-2 text-sm text-body whitespace-pre-wrap leading-relaxed"
                />
              )}
            </div>

            <div className="flex items-center gap-2.5 bg-background/50 border border-surface-border/50 rounded-lg px-3.5 py-2.5 w-fit">
              <Clock className="h-4 w-4 text-muted shrink-0" />
              <span className="text-sm font-medium text-heading">
                {formatDueDate(activity.due_date)}
              </span>
            </div>
          </div>

          {isGroupAdmin && (
            <div className="flex shrink-0 gap-2 items-center sm:items-start pt-4 sm:pt-0 border-t border-surface-border/50 sm:border-t-0 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={openEdit}
                className="shadow-sm border-surface-border/60 hover:border-secondary/40 hover:bg-surface-light"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {t("GROUP_EDIT_BUTTON")}
              </Button>
              <button
                onClick={handleDelete}
                className="flex items-center justify-center rounded-lg border border-surface-border/60 p-2 text-red-400 hover:bg-red-500/10 hover:border-red-400/40 hover:text-red-500 transition-colors shadow-sm"
                title={t("ACTIVITY_DELETE_BUTTON")}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
              </button>
            </div>
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

      {/* Activity Items */}
      <ActivityItems activityId={activityId} isAdmin={isGroupAdmin} />

      {/* Admin: Student Submissions */}
      {isGroupAdmin && <ActivitySubmissions activityId={activityId} />}

      {/* Activity Submission */}
      {!isGroupAdmin && (
        <div className="rounded-lg border border-surface-border bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-heading">
            <Send className="h-5 w-5 text-secondary" />
            {t("ACTIVITY_SUBMISSION_TITLE")}
          </h2>

          {submission ? (
            <div className="space-y-3">
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${
                  submission.status === "approved"
                    ? "border border-green-200 bg-green-50 text-green-800"
                    : submission.status === "reproved"
                      ? "border border-red-200 bg-red-50 text-red-800"
                      : "border border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {submission.status === "approved" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : submission.status === "reproved" ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <ClockIcon className="h-5 w-5 text-amber-600" />
                )}
                <span className="font-medium">
                  {t(
                    `ACTIVITY_SUBMISSION_STATUS_${submission.status.toUpperCase()}` as Parameters<
                      typeof t
                    >[0],
                  )}
                </span>
                <span className="ml-auto text-sm">
                  {new Date(submission.submitted_at).toLocaleDateString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </span>
              </div>

              {/* Editable notes when pending or reproved, read-only when approved */}
              {submission.status === "pending" ||
              submission.status === "reproved" ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-heading">
                    {t("ACTIVITY_SUBMISSION_NOTES")}
                  </label>
                  <textarea
                    value={editingSubNotes}
                    onChange={(e) => setEditingSubNotes(e.target.value)}
                    rows={3}
                    placeholder={t("ACTIVITY_SUBMISSION_NOTES_PLACEHOLDER")}
                    className="w-full rounded-lg border border-surface-border bg-background p-3 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={savingNotes}
                      onClick={handleSaveSubNotes}
                      className="w-auto"
                    >
                      {t("ACTIVITY_SUBMISSION_SAVE_NOTES")}
                    </Button>
                  </div>
                </div>
              ) : (
                submission.notes && (
                  <div className="text-sm text-muted">
                    <span className="font-medium text-heading">
                      {t("ACTIVITY_SUBMISSION_NOTES")}:
                    </span>{" "}
                    {submission.notes}
                  </div>
                )
              )}

              {submission.feedback_notes && (
                <div className="rounded-lg border border-surface-border bg-background p-3 text-sm">
                  <span className="font-medium text-heading">
                    {t("ACTIVITY_SUBMISSION_FEEDBACK")}:
                  </span>{" "}
                  <span className="text-body">{submission.feedback_notes}</span>
                </div>
              )}

              {/* Submission attachments (visible always, editable when pending or reproved) */}
              <div className="rounded-lg border border-surface-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
                    <Paperclip className="h-4 w-4 text-secondary" />
                    {t("ACTIVITY_SUBMISSION_ATTACHMENTS_TITLE")}
                  </h3>
                  {(submission.status === "pending" ||
                    submission.status === "reproved") && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        className="hidden"
                        onChange={handleUploadSubAttachment}
                        disabled={uploadingSubFile}
                      />
                      <span className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors">
                        {uploadingSubFile ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        {t("ACTIVITY_SUBMISSION_UPLOAD_ATTACHMENT")}
                      </span>
                    </label>
                  )}
                </div>

                {subAttachments.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">
                    {t("ACTIVITY_SUBMISSION_ATTACHMENTS_EMPTY")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {subAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-lg border border-surface-border bg-surface p-2.5"
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
                        {(submission.status === "pending" ||
                          submission.status === "reproved") && (
                          <button
                            onClick={() => handleDeleteSubAttachment(att.id)}
                            disabled={deletingSubFile === att.id}
                            className="ml-3 shrink-0 rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50"
                          >
                            {deletingSubFile === att.id ? (
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

              {/* Resubmit button when reproved */}
              {submission.status === "reproved" && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    loading={resubmitting}
                    onClick={handleResubmit}
                    className="w-auto"
                  >
                    <Send className="h-4 w-4" />
                    {t("ACTIVITY_SUBMISSION_RESUBMIT")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                {t("ACTIVITY_SUBMISSION_DESCRIPTION")}
              </p>
              <textarea
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                rows={3}
                placeholder={t("ACTIVITY_SUBMISSION_NOTES_PLACEHOLDER")}
                className="w-full rounded-lg border border-surface-border bg-background p-3 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  loading={submitting}
                  onClick={handleSubmitActivity}
                  className="w-auto"
                >
                  <Send className="h-4 w-4" />
                  {t("ACTIVITY_SUBMISSION_SUBMIT")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
                <p className="mt-1 text-xs text-muted">
                  {t("QUESTION_LATEX_HINT")}
                </p>
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
