"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Users,
  CheckCircle2,
  XCircle,
  ClockIcon,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Paperclip,
  FileText,
  Image,
  Eye,
  HelpCircle,
} from "lucide-react";
import {
  listActivitySubmissions,
  reviewActivitySubmission,
  listSubmissionAttachments,
  getSubmissionQuestionAttempts,
  type ActivitySubmissionResponse,
  type SubmissionAttachmentResponse,
  type ReviewActivitySubmissionInput,
  type QuestionSubmissionAttempt,
} from "@/lib/activity-submissions";
import { listActivityItems, type ActivityItemResponse } from "@/lib/activities";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LatexText } from "@/components/ui/latex-text";
import { useToast } from "@/components/ui/toast";

interface ActivitySubmissionsProps {
  activityId: string;
}

export function ActivitySubmissions({ activityId }: ActivitySubmissionsProps) {
  const t = useTranslations();
  const { toast } = useToast();

  const [submissions, setSubmissions] = useState<ActivitySubmissionResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Review modal
  const [reviewTarget, setReviewTarget] =
    useState<ActivitySubmissionResponse | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "reproved">(
    "approved",
  );
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Expanded submission (to show details + attachments)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedAttachments, setExpandedAttachments] = useState<
    SubmissionAttachmentResponse[]
  >([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Activity items (for question → title mapping)
  const [activityItems, setActivityItems] = useState<ActivityItemResponse[]>(
    [],
  );

  // Question attempts for expanded submission
  const [questionAttempts, setQuestionAttempts] = useState<
    QuestionSubmissionAttempt[]
  >([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listActivitySubmissions(activityId, page, 10);
      setSubmissions(res.data ?? []);
      setTotalPages(res.total_pages);
      setTotalItems(res.total_items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activityId, page]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Fetch activity items once to map question_id → title
  useEffect(() => {
    listActivityItems(activityId)
      .then((items) => setActivityItems(items ?? []))
      .catch(() => {});
  }, [activityId]);

  // Build a map from question public ID to activity item title
  const questionTitleMap = new Map<string, string>();
  for (const item of activityItems) {
    if (item.question_id) {
      questionTitleMap.set(item.question_id, item.title);
    }
  }

  async function toggleExpand(sub: ActivitySubmissionResponse) {
    if (expandedId === sub.id) {
      setExpandedId(null);
      setExpandedAttachments([]);
      setQuestionAttempts([]);
      setOpenQuestionId(null);
      return;
    }
    setExpandedId(sub.id);
    setLoadingAttachments(true);
    setLoadingAttempts(true);
    setOpenQuestionId(null);
    try {
      const [atts, attempts] = await Promise.all([
        listSubmissionAttachments(sub.id).catch(() => []),
        getSubmissionQuestionAttempts(sub.id).catch(() => []),
      ]);
      setExpandedAttachments(atts ?? []);
      setQuestionAttempts(attempts ?? []);
    } catch {
      setExpandedAttachments([]);
      setQuestionAttempts([]);
    } finally {
      setLoadingAttachments(false);
      setLoadingAttempts(false);
    }
  }

  function openReview(sub: ActivitySubmissionResponse) {
    setReviewTarget(sub);
    setReviewStatus("approved");
    setReviewFeedback("");
  }

  async function handleReview() {
    if (!reviewTarget || reviewing) return;
    setReviewing(true);
    try {
      const input: ReviewActivitySubmissionInput = {
        status: reviewStatus,
        feedback_notes: reviewFeedback.trim() || undefined,
      };
      await reviewActivitySubmission(reviewTarget.id, input);
      toast(t("ACTIVITY_SUBMISSIONS_REVIEW_SUCCESS"));
      setReviewTarget(null);
      await fetchSubmissions();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setReviewing(false);
    }
  }

  function statusIcon(status: string) {
    if (status === "approved")
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (status === "reproved")
      return <XCircle className="h-4 w-4 text-red-400" />;
    return <ClockIcon className="h-4 w-4 text-amber-400" />;
  }

  function statusBadge(status: string) {
    const base =
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";
    if (status === "approved")
      return `${base} bg-green-500/10 text-green-400 border border-green-500/20`;
    if (status === "reproved")
      return `${base} bg-red-500/10 text-red-400 border border-red-500/20`;
    return `${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
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
      return <Image className="h-4 w-4 text-blue-400" />;
    }
    return <FileText className="h-4 w-4 text-secondary" />;
  }

  // Group question attempts by question ID
  function groupAttemptsByQuestion(attempts: QuestionSubmissionAttempt[]): {
    questionId: string;
    title: string;
    statement: string;
    type: string;
    attempts: QuestionSubmissionAttempt[];
    bestPassed: boolean;
  }[] {
    const map = new Map<
      string,
      {
        questionId: string;
        title: string;
        statement: string;
        type: string;
        attempts: QuestionSubmissionAttempt[];
        bestPassed: boolean;
      }
    >();
    for (const a of attempts) {
      let group = map.get(a.question.id);
      if (!group) {
        group = {
          questionId: a.question.id,
          title: questionTitleMap.get(a.question.id) ?? "",
          statement: a.question.statement,
          type: a.question.type,
          attempts: [],
          bestPassed: false,
        };
        map.set(a.question.id, group);
      }
      group.attempts.push(a);
      if (a.passed) group.bestPassed = true;
    }
    return Array.from(map.values());
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
          <Users className="h-5 w-5 text-secondary" />
          {t("ACTIVITY_SUBMISSIONS_ADMIN_TITLE")}
          {totalItems > 0 && (
            <span className="ml-1 text-sm font-normal text-muted">
              ({totalItems})
            </span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-secondary" />
        </div>
      ) : submissions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {t("ACTIVITY_SUBMISSIONS_EMPTY")}
        </p>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-lg border border-surface-border bg-background"
            >
              {/* Submission row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
                  {/* User avatar */}
                  {sub.user.avatar_url ? (
                    <img
                      src={sub.user.avatar_url}
                      alt={sub.user.name}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-light text-xs font-bold text-muted uppercase">
                      {sub.user.name.charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 mt-1">
                    <p className="text-sm font-medium text-heading break-all line-clamp-2 leading-tight">
                      {sub.user.name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatDate(sub.submitted_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-surface-border/50 sm:border-t-0">
                  {/* Status badge */}
                  <div className="flex justify-start">
                    <span className={statusBadge(sub.status)}>
                      {statusIcon(sub.status)}
                      <span className="truncate">
                        {t(
                          `ACTIVITY_SUBMISSION_STATUS_${sub.status.toUpperCase()}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                    {sub.status === "pending" && (
                      <button
                        onClick={() => openReview(sub)}
                        className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-light px-3 py-1.5 text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors shadow-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-1 break-all text-left leading-tight hidden sm:inline">{t("ACTIVITY_SUBMISSIONS_REVIEW_BUTTON")}</span>
                        <span className="line-clamp-1 break-all text-left leading-tight sm:hidden">{t("ACTIVITY_SUBMISSIONS_REVIEW_TITLE")}</span>
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(sub)}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-light p-1.5 text-muted hover:text-heading transition-colors shadow-sm"
                      title={t("ACTIVITY_SUBMISSIONS_TOGGLE_DETAILS")}
                    >
                      {expandedId === sub.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === sub.id && (
                <div className="border-t border-surface-border px-3 pb-3 pt-2 space-y-3">
                  {/* Notes */}
                  {sub.notes && (
                    <div className="text-sm">
                      <span className="font-medium text-heading">
                        {t("ACTIVITY_SUBMISSION_NOTES")}:
                      </span>{" "}
                      <span className="text-muted">{sub.notes}</span>
                    </div>
                  )}

                  {/* Feedback */}
                  {sub.feedback_notes && (
                    <div className="rounded-lg border border-surface-border bg-surface p-2.5 text-sm">
                      <span className="font-medium text-heading">
                        {t("ACTIVITY_SUBMISSION_FEEDBACK")}:
                      </span>{" "}
                      <span className="text-body">{sub.feedback_notes}</span>
                    </div>
                  )}

                  {/* Reviewed by */}
                  {sub.reviewed_by && sub.reviewed_at && (
                    <p className="text-xs text-muted">
                      {t("ACTIVITY_SUBMISSIONS_REVIEWED_BY", {
                        name: sub.reviewed_by.name,
                        date: formatDate(sub.reviewed_at),
                      })}
                    </p>
                  )}

                  {/* Attachments */}
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-heading">
                      <Paperclip className="h-3.5 w-3.5 text-secondary" />
                      {t("ACTIVITY_SUBMISSION_ATTACHMENTS_TITLE")}
                    </p>
                    {loadingAttachments ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                      </div>
                    ) : expandedAttachments.length === 0 ? (
                      <p className="text-center text-xs text-muted py-2">
                        {t("ACTIVITY_SUBMISSION_ATTACHMENTS_EMPTY")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {expandedAttachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface p-2 text-sm hover:text-secondary transition-colors"
                            >
                              <div className="shrink-0">{getFileIcon(att.content_type)}</div>
                              <div className="min-w-0 flex-1 flex flex-col">
                                <span className="line-clamp-1 break-all text-xs font-medium text-heading">
                                  {att.filename}
                                </span>
                                <span className="text-[10px] text-muted leading-tight">
                                  {formatFileSize(att.size_bytes)}
                                </span>
                              </div>
                              <Eye className="h-4 w-4 shrink-0 text-muted ml-1" />
                            </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Question Answers */}
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-heading">
                      <HelpCircle className="h-3.5 w-3.5 text-secondary" />
                      {t("ACTIVITY_SUBMISSIONS_QUESTION_ANSWERS")}
                    </p>
                    {loadingAttempts ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                      </div>
                    ) : questionAttempts.length === 0 ? (
                      <p className="text-center text-xs text-muted py-2">
                        {t("ACTIVITY_SUBMISSIONS_NO_QUESTION_ANSWERS")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {groupAttemptsByQuestion(questionAttempts).map(
                          (group) => (
                            <div
                              key={group.questionId}
                              className="rounded-lg border border-surface-border bg-surface overflow-hidden"
                            >
                              {/* Question header — clickable to expand attempts */}
                              <button
                                onClick={() =>
                                  setOpenQuestionId(
                                    openQuestionId === group.questionId
                                      ? null
                                      : group.questionId,
                                  )
                                }
                                className="flex w-full items-start gap-2 p-2.5 text-left transition-colors hover:bg-surface-light group"
                              >
                                {group.bestPassed ? (
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400 group-hover:opacity-80 transition-opacity" />
                                ) : (
                                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400 group-hover:opacity-80 transition-opacity" />
                                )}
                                <div className="min-w-0 flex-1">
                                  {group.title && (
                                    <span className="block truncate text-xs font-medium text-heading">
                                      {group.title}
                                    </span>
                                  )}
                                  <span className="block truncate text-[10px] text-muted">
                                    {group.statement
                                      .replace(/<[^>]*>/g, " ")
                                      .replace(/\n/g, " ")
                                      .replace(/\s+/g, " ")
                                      .trim()}
                                  </span>
                                </div>
                                <span className="shrink-0 text-[10px] text-muted">
                                  {t("ACTIVITY_SUBMISSIONS_ATTEMPTS_COUNT", {
                                    count: group.attempts.length,
                                  })}
                                </span>
                                {openQuestionId === group.questionId ? (
                                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                                )}
                              </button>

                              {/* Attempts dropdown */}
                              {openQuestionId === group.questionId && (
                                <div className="border-t border-surface-border bg-background">
                                  {group.attempts.map((attempt, idx) => (
                                    <div
                                      key={attempt.id}
                                      className="flex items-start gap-2 border-b border-surface-border/50 px-3 py-2 last:border-b-0"
                                    >
                                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold bg-surface-light text-muted">
                                        {group.attempts.length - idx}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        {/* Answer given */}
                                        {attempt.option_selected && (
                                          <p className="text-xs text-body">
                                            <span className="font-medium text-heading">
                                              {t(
                                                "ACTIVITY_SUBMISSIONS_SELECTED_OPTION",
                                              )}
                                              :
                                            </span>{" "}
                                            <LatexText
                                              text={
                                                attempt.option_selected.text ??
                                                attempt.option_selected.id
                                              }
                                              as="span"
                                              className={
                                                attempt.option_selected
                                                  .is_correct
                                                  ? "text-green-400"
                                                  : "text-red-400"
                                              }
                                            />
                                          </p>
                                        )}
                                        {attempt.answer_text && (
                                          <div className="text-xs text-body line-clamp-3">
                                            <span className="font-medium text-heading">
                                              {t(
                                                "ACTIVITY_SUBMISSIONS_ANSWER_TEXT",
                                              )}
                                              :
                                            </span>{" "}
                                            <LatexText
                                              text={attempt.answer_text}
                                              as="span"
                                              className="text-body"
                                            />
                                          </div>
                                        )}
                                        {attempt.score != null && (
                                          <p className="text-[11px] text-muted">
                                            {t("ACTIVITY_SUBMISSIONS_SCORE")}:{" "}
                                            {attempt.score}%
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                                        {attempt.passed ? (
                                          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-400 border border-green-500/20">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {t(
                                              "ACTIVITY_ITEM_QUESTION_CORRECT",
                                            )}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
                                            <XCircle className="h-3 w-3" />
                                            {t(
                                              "ACTIVITY_ITEM_QUESTION_INCORRECT",
                                            )}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-muted">
                                          {formatDate(attempt.submitted_at)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Review button inside expanded for non-pending too */}
                  {sub.status !== "pending" && (
                    <div className="flex pt-2">
                       <button
                        onClick={() => openReview(sub)}
                        className="inline-flex min-w-0 flex-1 sm:flex-none justify-center items-center gap-1.5 rounded-lg border border-surface-border bg-surface-light px-3 py-1.5 text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors shadow-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t("ACTIVITY_SUBMISSIONS_CHANGE_REVIEW")}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-auto px-3"
              >
                {t("ACTIVITY_SUBMISSIONS_PAGE_PREV")}
              </Button>
              <span className="text-xs text-muted">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="w-auto px-3"
              >
                {t("ACTIVITY_SUBMISSIONS_PAGE_NEXT")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-background p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-heading">
                {t("ACTIVITY_SUBMISSIONS_REVIEW_TITLE")}
              </h2>
              <button
                onClick={() => setReviewTarget(null)}
                className="text-muted hover:text-heading"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Submission info */}
            <div className="mb-4 rounded-lg border border-surface-border bg-surface p-3">
              <p className="text-sm font-medium text-heading">
                {reviewTarget.user.name}
              </p>
              <p className="text-xs text-muted">
                {formatDate(reviewTarget.submitted_at)}
              </p>
              {reviewTarget.notes && (
                <p className="mt-2 text-sm text-muted">{reviewTarget.notes}</p>
              )}
            </div>

            {/* Status select */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-body">
                {t("ACTIVITY_SUBMISSIONS_REVIEW_STATUS")}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewStatus("approved")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    reviewStatus === "approved"
                      ? "border-green-500/40 bg-green-500/10 text-green-400"
                      : "border-surface-border text-muted hover:text-heading"
                  }`}
                >
                  <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                  {t("ACTIVITY_SUBMISSION_STATUS_APPROVED")}
                </button>
                <button
                  onClick={() => setReviewStatus("reproved")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    reviewStatus === "reproved"
                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                      : "border-surface-border text-muted hover:text-heading"
                  }`}
                >
                  <XCircle className="mr-1.5 inline h-4 w-4" />
                  {t("ACTIVITY_SUBMISSION_STATUS_REPROVED")}
                </button>
              </div>
            </div>

            {/* Feedback */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-body">
                {t("ACTIVITY_SUBMISSIONS_REVIEW_FEEDBACK")}
              </label>
              <textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={3}
                placeholder={t(
                  "ACTIVITY_SUBMISSIONS_REVIEW_FEEDBACK_PLACEHOLDER",
                )}
                className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body placeholder-muted outline-none focus:border-secondary"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewTarget(null)}
                className="flex-1"
              >
                {t("PROFILE_CANCEL")}
              </Button>
              <Button
                size="sm"
                loading={reviewing}
                onClick={handleReview}
                className="flex-1"
              >
                {t("ACTIVITY_SUBMISSIONS_REVIEW_CONFIRM")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
