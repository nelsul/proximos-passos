"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Loader2,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import {
  listMySubmissions,
  type QuestionSubmissionResponse,
} from "@/lib/submissions";
import { LatexText } from "@/components/ui/latex-text";
import { stripImageMarkers } from "@/components/questions/statement-renderer";
import { Button } from "@/components/ui/button";

interface QuestionGroup {
  questionId: string;
  questionType: string;
  questionStatement: string;
  submissions: QuestionSubmissionResponse[];
  bestScore: number | null;
  lastPassed: boolean;
  lastSubmittedAt: string;
}

function groupByQuestion(
  submissions: QuestionSubmissionResponse[],
): QuestionGroup[] {
  const map = new Map<string, QuestionGroup>();
  for (const sub of submissions) {
    const key = sub.question.id;
    let group = map.get(key);
    if (!group) {
      group = {
        questionId: sub.question.id,
        questionType: sub.question.type,
        questionStatement: sub.question.statement,
        submissions: [],
        bestScore: null,
        lastPassed: false,
        lastSubmittedAt: sub.submitted_at,
      };
      map.set(key, group);
    }
    group.submissions.push(sub);
    if (sub.score != null) {
      if (group.bestScore == null || sub.score > group.bestScore) {
        group.bestScore = sub.score;
      }
    }
  }
  // Sort groups by most recent submission first
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.submissions.sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );
    g.lastPassed = g.submissions[0]?.passed ?? false;
    g.lastSubmittedAt = g.submissions[0]?.submitted_at ?? "";
  }
  groups.sort(
    (a, b) =>
      new Date(b.lastSubmittedAt).getTime() -
      new Date(a.lastSubmittedAt).getTime(),
  );
  return groups;
}

export default function SubmissionsPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [submissions, setSubmissions] = useState<QuestionSubmissionResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchSubmissions = useCallback(
    async (pageNum = 1, statement?: string) => {
      setLoading(true);
      try {
        const res = await listMySubmissions(
          pageNum,
          100,
          statement || undefined,
        );
        setSubmissions(res.data ?? []);
        setTotalPages(res.total_pages);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch when debounced search or page changes
  useEffect(() => {
    fetchSubmissions(page, debouncedSearch);
  }, [page, debouncedSearch, fetchSubmissions]);

  const groups = useMemo(() => groupByQuestion(submissions), [submissions]);

  function toggleExpand(questionId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-heading">
          {t("SUBMISSIONS_TITLE")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("SUBMISSIONS_SUBTITLE")}</p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("SUBMISSION_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("SUBMISSIONS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {groups.map((group) => {
              const isExpanded = expandedIds.has(group.questionId);
              return (
                <div
                  key={group.questionId}
                  className="rounded-lg border border-surface-border bg-surface overflow-hidden"
                >
                  {/* Question group header */}
                  <button
                    onClick={() => toggleExpand(group.questionId)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-light"
                  >
                    {group.lastPassed ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-heading line-clamp-2">
                        <LatexText
                          text={stripImageMarkers(group.questionStatement)}
                        />
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="rounded-full bg-surface-light px-2 py-0.5">
                          {group.questionType === "open_ended"
                            ? t("QUESTION_TYPE_OPEN_ENDED")
                            : t("QUESTION_TYPE_CLOSED_ENDED")}
                        </span>
                        <span>·</span>
                        <span>
                          {t("SUBMISSION_ATTEMPTS", {
                            count: group.submissions.length,
                          })}
                        </span>
                        {group.bestScore != null && (
                          <>
                            <span>·</span>
                            <span
                              className={
                                group.bestScore >= 50
                                  ? "text-green-600"
                                  : "text-red-500"
                              }
                            >
                              {t("SUBMISSION_BEST_SCORE", {
                                score: group.bestScore,
                              })}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          {t("SUBMISSION_LAST_ATTEMPT")}:{" "}
                          {formatDate(group.lastSubmittedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/${locale}/dashboard/questions/${group.questionId}/answer`,
                          );
                        }}
                        title={t("SUBMISSION_ANSWER_AGAIN")}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-heading"
                      >
                        <Send className="h-4 w-4" />
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded: individual attempts */}
                  {isExpanded && (
                    <div className="border-t border-surface-border bg-background">
                      {group.submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 border-b border-surface-border/50 px-4 py-3 last:border-b-0"
                        >
                          {sub.passed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span>{formatDate(sub.submitted_at)}</span>
                              {sub.score != null && (
                                <>
                                  <span>·</span>
                                  <span
                                    className={
                                      sub.passed
                                        ? "text-green-600"
                                        : "text-red-500"
                                    }
                                  >
                                    {sub.score}%
                                  </span>
                                </>
                              )}
                              {sub.option_selected && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {sub.option_selected.is_correct
                                      ? t("SUBMISSION_CORRECT")
                                      : t("SUBMISSION_INCORRECT")}
                                  </span>
                                </>
                              )}
                              {sub.answer_text && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-xs">
                                    {sub.answer_text}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("QUESTION_PAGE_PREV")}
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
                {t("QUESTION_PAGE_NEXT")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
