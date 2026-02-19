"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Loader2,
  Search,
  HelpCircle,
  Trash2,
  Pencil,
  X,
  ImageIcon,
  Eye,
  Send,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import {
  listQuestions,
  deleteQuestion,
  type QuestionResponse,
} from "@/lib/questions";
import { listExams, type ExamResponse } from "@/lib/exams";
import { listInstitutions, type InstitutionResponse } from "@/lib/institutions";
import { LatexText } from "@/components/ui/latex-text";
import { stripImageMarkers } from "@/components/questions/statement-renderer";
import { TopicPickerModal } from "@/components/handouts/topic-picker-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useIsAdmin } from "@/contexts/user-context";

export default function QuestionsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const toastShown = useRef(false);
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showTopicFilter, setShowTopicFilter] = useState(false);
  const [examFilter, setExamFilter] = useState(
    searchParams.get("exam_id") ?? "",
  );
  const [institutionFilter, setInstitutionFilter] = useState(
    searchParams.get("institution_id") ?? "",
  );
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load exams and institutions for filter dropdowns
  useEffect(() => {
    listExams(1, 200).then((res) => setExams(res.data ?? []));
    listInstitutions(1, 200).then((res) => setInstitutions(res.data ?? []));
  }, []);

  const fetchQuestions = useCallback(
    async (
      statement?: string,
      type?: string,
      topicId?: string,
      examId?: string,
      institutionId?: string,
      pageNum = 1,
    ) => {
      setLoading(true);
      try {
        const filter: {
          statement?: string;
          type?: string;
          topic_id?: string;
          exam_id?: string;
          institution_id?: string;
        } = {};
        if (statement) filter.statement = statement;
        if (type) filter.type = type;
        if (topicId) filter.topic_id = topicId;
        if (examId) filter.exam_id = examId;
        if (institutionId) filter.institution_id = institutionId;
        const res = await listQuestions(
          pageNum,
          20,
          Object.keys(filter).length > 0 ? filter : undefined,
        );
        setQuestions(res.data ?? []);
        setTotalPages(res.total_pages);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchQuestions(
        search || undefined,
        typeFilter || undefined,
        topicFilter?.id,
        examFilter || undefined,
        institutionFilter || undefined,
        1,
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [
    search,
    typeFilter,
    topicFilter,
    examFilter,
    institutionFilter,
    fetchQuestions,
  ]);

  useEffect(() => {
    fetchQuestions(
      search || undefined,
      typeFilter || undefined,
      topicFilter?.id,
      examFilter || undefined,
      institutionFilter || undefined,
      page,
    );
  }, [
    page,
    fetchQuestions,
    search,
    typeFilter,
    topicFilter,
    examFilter,
    institutionFilter,
  ]);

  // Show toast from URL params (after create/edit redirect)
  useEffect(() => {
    if (toastShown.current) return;
    const success = searchParams.get("success");
    if (success === "created") {
      toast(t("QUESTION_CREATE_SUCCESS"));
      toastShown.current = true;
      window.history.replaceState({}, "", window.location.pathname);
    } else if (success === "updated") {
      toast(t("QUESTION_UPDATE_SUCCESS"));
      toastShown.current = true;
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams, toast, t]);

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteQuestion(id);
      toast(t("QUESTION_DELETE_SUCCESS"));
      fetchQuestions(
        search || undefined,
        typeFilter || undefined,
        topicFilter?.id,
        examFilter || undefined,
        institutionFilter || undefined,
        page,
      );
    } finally {
      setDeletingId(null);
    }
  }

  function typeLabel(type: string): string {
    if (type === "open_ended") return t("QUESTION_TYPE_OPEN_ENDED");
    if (type === "closed_ended") return t("QUESTION_TYPE_CLOSED_ENDED");
    return type;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            {t("QUESTIONS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("QUESTIONS_SUBTITLE")}</p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/questions/new`)}
          >
            <Plus className="h-4 w-4" />
            {t("QUESTION_CREATE_BUTTON")}
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("QUESTION_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="shrink-0 rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted outline-none transition-colors hover:border-secondary hover:text-heading focus:border-secondary focus:ring-1 focus:ring-secondary"
        >
          <option value="">{t("QUESTION_ALL_TYPES")}</option>
          <option value="open_ended">{t("QUESTION_TYPE_OPEN_ENDED")}</option>
          <option value="closed_ended">
            {t("QUESTION_TYPE_CLOSED_ENDED")}
          </option>
        </select>

        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="shrink-0 rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted outline-none transition-colors hover:border-secondary hover:text-heading focus:border-secondary focus:ring-1 focus:ring-secondary"
        >
          <option value="">{t("QUESTION_ALL_EXAMS")}</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.institution.name} — {exam.title} ({exam.year})
            </option>
          ))}
        </select>

        <select
          value={institutionFilter}
          onChange={(e) => setInstitutionFilter(e.target.value)}
          className="shrink-0 rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted outline-none transition-colors hover:border-secondary hover:text-heading focus:border-secondary focus:ring-1 focus:ring-secondary"
        >
          <option value="">{t("QUESTION_ALL_INSTITUTIONS")}</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name} ({inst.acronym})
            </option>
          ))}
        </select>

        {topicFilter ? (
          <button
            onClick={() => setTopicFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary/20"
          >
            {topicFilter.name}
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => setShowTopicFilter(true)}
            className="shrink-0 rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
          >
            {t("QUESTION_FILTER_BY_TOPIC")}
          </button>
        )}
      </div>

      {showTopicFilter && (
        <TopicPickerModal
          selected={[]}
          onConfirm={(topic) => {
            setTopicFilter(topic);
            setShowTopicFilter(false);
          }}
          onClose={() => setShowTopicFilter(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <HelpCircle className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("QUESTIONS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface p-4 transition-colors hover:bg-surface-light"
              >
                <HelpCircle className="h-5 w-5 shrink-0 text-secondary" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-heading line-clamp-2">
                    <LatexText text={stripImageMarkers(q.statement)} />
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded-full bg-surface-light px-2 py-0.5">
                      {typeLabel(q.type)}
                    </span>
                    {q.exam && (
                      <>
                        <span>·</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {q.exam.institution} — {q.exam.title} ({q.exam.year})
                        </span>
                      </>
                    )}
                    {q.images.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {q.images.length}
                        </span>
                      </>
                    )}
                    {q.passing_score != null && (
                      <>
                        <span>·</span>
                        <span>{q.passing_score}%</span>
                      </>
                    )}
                    {q.options.length > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {q.options.length} {t("QUESTION_OPTIONS_COUNT")}
                        </span>
                      </>
                    )}
                    {q.topics.length > 0 && (
                      <>
                        <span>·</span>
                        {q.topics.map((topic) => (
                          <span
                            key={topic.id}
                            className="rounded-full bg-secondary/10 px-2 py-0.5 text-secondary"
                          >
                            {topic.name}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() =>
                      router.push(
                        `/${locale}/dashboard/questions/${q.id}/answer`,
                      )
                    }
                    title={t("SUBMISSION_ANSWER_BUTTON")}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      window.open(
                        `/${locale}/print/questions/${q.id}`,
                        "_blank",
                      )
                    }
                    title={t("QUESTION_PRINT_PREVIEW")}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        router.push(
                          `/${locale}/dashboard/questions/${q.id}/edit`,
                        )
                      }
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
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
