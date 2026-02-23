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
  Send,
  Brain,
  Cpu,
  BookOpen,
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FilterTooltip } from "@/components/ui/filter-tooltip";
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
  const [topicFilters, setTopicFilters] = useState<{
    id: string;
    name: string;
  }[]>([]);
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

  // Load exams and institutions for filter dropdowns (initial set, then backend search on type)
  useEffect(() => {
    listExams(1, 50).then((res) => setExams(res.data ?? []));
    listInstitutions(1, 50).then((res) => setInstitutions(res.data ?? []));
  }, []);

  const fetchQuestions = useCallback(
    async (
      statement?: string,
      type?: string,
      topicIds?: string[],
      examId?: string,
      institutionId?: string,
      pageNum = 1,
    ) => {
      setLoading(true);
      try {
        const filter: {
          statement?: string;
          type?: string;
          topic_id?: string | string[];
          exam_id?: string;
          institution_id?: string;
        } = {};
        if (statement) filter.statement = statement;
        if (type) filter.type = type;
        if (topicIds && topicIds.length > 0) filter.topic_id = topicIds;
        if (examId) filter.exam_id = examId;
        if (institutionId) filter.institution_id = institutionId;
        const res = await listQuestions(
          pageNum,
          10,
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
        topicFilters.length > 0 ? topicFilters.map(t => t.id) : undefined,
        examFilter || undefined,
        institutionFilter || undefined,
        1,
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [
    search,
    typeFilter,
    topicFilters,
    examFilter,
    institutionFilter,
    fetchQuestions,
  ]);

  useEffect(() => {
    fetchQuestions(
      search || undefined,
      typeFilter || undefined,
      topicFilters.length > 0 ? topicFilters.map(t => t.id) : undefined,
      examFilter || undefined,
      institutionFilter || undefined,
      page,
    );
  }, [
    page,
    fetchQuestions,
    search,
    typeFilter,
    topicFilters,
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
        topicFilters.length > 0 ? topicFilters.map(t => t.id) : undefined,
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
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading">
            {t("QUESTIONS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("QUESTIONS_SUBTITLE")}</p>
        </div>
        {isAdmin && (
          <Button
            className="w-full sm:w-auto"
            onClick={() => router.push(`/${locale}/dashboard/questions/new`)}
          >
            <Plus className="h-4 w-4" />
            {t("QUESTION_CREATE_BUTTON")}
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center">
          <div className="relative sm:col-span-2 lg:flex-1">
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
            className="w-full lg:w-40 shrink-0 rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted outline-none transition-colors hover:border-secondary hover:text-heading focus:border-secondary focus:ring-1 focus:ring-secondary"
          >
            <option value="">{t("QUESTION_ALL_TYPES")}</option>
            <option value="open_ended">{t("QUESTION_TYPE_OPEN_ENDED")}</option>
            <option value="closed_ended">
              {t("QUESTION_TYPE_CLOSED_ENDED")}
            </option>
          </select>

          <SearchableSelect
            value={examFilter}
            onChange={setExamFilter}
            options={exams.map((exam) => ({
              value: exam.id,
              label: `${exam.institution.acronym} — ${exam.title} (${exam.year})`,
            }))}
            onSearch={async (q) => {
              const res = await listExams(1, 50, q ? { search: q } : undefined);
              return (res.data ?? []).map((exam) => ({
                value: exam.id,
                label: `${exam.institution.acronym} — ${exam.title} (${exam.year})`,
              }));
            }}
            placeholder={t("QUESTION_ALL_EXAMS")}
            searchPlaceholder={t("SEARCHABLE_SELECT_SEARCH_PLACEHOLDER")}
            emptyMessage={t("SEARCHABLE_SELECT_EMPTY")}
            className="w-full lg:w-48 shrink-0"
          />

          <SearchableSelect
            value={institutionFilter}
            onChange={setInstitutionFilter}
            options={institutions.map((inst) => ({
              value: inst.id,
              label: `${inst.name} (${inst.acronym})`,
            }))}
            onSearch={async (q) => {
              const res = await listInstitutions(1, 50, q ? { name: q } : undefined);
              return (res.data ?? []).map((inst) => ({
                value: inst.id,
                label: `${inst.name} (${inst.acronym})`,
              }));
            }}
            placeholder={t("QUESTION_ALL_INSTITUTIONS")}
            searchPlaceholder={t("SEARCHABLE_SELECT_SEARCH_PLACEHOLDER")}
            emptyMessage={t("SEARCHABLE_SELECT_EMPTY")}
            className="w-full lg:w-48 shrink-0"
          />
        </div>

        {topicFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2 items-center">
            {topicFilters.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopicFilters(prev => prev.filter(p => p.id !== t.id))}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-secondary/10 px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary/20"
              >
                {t.name}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
            <button
              onClick={() => setShowTopicFilter(true)}
              className="inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-full border border-dashed border-surface-border bg-background px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-secondary hover:text-heading"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("QUESTION_FILTER_BY_TOPIC")}
            </button>
            <FilterTooltip />
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => setShowTopicFilter(true)}
              className="w-full whitespace-nowrap rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
            >
              {t("QUESTION_FILTER_BY_TOPIC")}
            </button>
            <FilterTooltip />
          </div>
        )}
      </div>

      {showTopicFilter && (
        <TopicPickerModal
          selected={topicFilters}
          onConfirm={(topics) => {
            setTopicFilters(topics);
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
                className="flex flex-col gap-2 rounded-lg border border-surface-border bg-surface p-3 sm:p-4 transition-colors hover:bg-surface-light sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <HelpCircle className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
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
                          <span className="rounded-full border border-surface-border bg-surface-light px-2 py-0.5 text-muted">
                            {q.exam.institution_acronym || q.exam.institution} ·{" "}
                            {q.exam.title} ({q.exam.year})
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
                      {q.median_difficulty !== undefined && q.median_difficulty !== null && (
                        <>
                          <span>·</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {q.median_logic !== undefined && q.median_logic !== null && (
                              <span
                                className={`group/logic relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase cursor-default ${q.median_logic >= 2.25 ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                  q.median_logic >= 1.25 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                    "bg-green-500/10 text-green-400 border border-green-500/20"
                                  }`}
                              >
                                <Brain className="h-3 w-3" />
                                {q.median_logic >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : q.median_logic >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}
                                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/logic:opacity-100">{t("FEEDBACK_LOGIC")}</span>
                              </span>
                            )}
                            {q.median_labor !== undefined && q.median_labor !== null && (
                              <span
                                className={`group/labor relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase cursor-default ${q.median_labor >= 2.25 ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                  q.median_labor >= 1.25 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                    "bg-green-500/10 text-green-400 border border-green-500/20"
                                  }`}
                              >
                                <Cpu className="h-3 w-3" />
                                {q.median_labor >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : q.median_labor >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}
                                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/labor:opacity-100">{t("FEEDBACK_LABOR")}</span>
                              </span>
                            )}
                            {q.median_theory !== undefined && q.median_theory !== null && (
                              <span
                                className={`group/theory relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase cursor-default ${q.median_theory >= 2.25 ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                  q.median_theory >= 1.25 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                    "bg-green-500/10 text-green-400 border border-green-500/20"
                                  }`}
                              >
                                <BookOpen className="h-3 w-3" />
                                {q.median_theory >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : q.median_theory >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}
                                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/theory:opacity-100">{t("FEEDBACK_THEORY")}</span>
                              </span>
                            )}
                          </div>
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
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
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

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )
      }
    </div >
  );
}
