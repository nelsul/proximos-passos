import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Check, X, Search, Plus } from "lucide-react";
import { createActivityItem, type CreateActivityItemInput } from "@/lib/activities";
import { listQuestions } from "@/lib/questions";
import { listVideoLessons } from "@/lib/video-lessons";
import { listHandouts } from "@/lib/handouts";
import { listExerciseLists } from "@/lib/open-exercise-lists";
import { listExams, type ExamResponse } from "@/lib/exams";
import { listInstitutions, type InstitutionResponse } from "@/lib/institutions";
import { ApiRequestError } from "@/lib/api";
import { TopicPickerModal } from "@/components/handouts/topic-picker-modal";
import { stripImageMarkers } from "@/components/questions/statement-renderer";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { FilterTooltip } from "@/components/ui/filter-tooltip";
import { LatexText } from "@/components/ui/latex-text";

// ==========================================
// Create Item Modal (Complex Search)
// ==========================================

interface CreateItemModalProps {
  activityId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateItemModal({
  activityId,
  onClose,
  onCreated,
}: CreateItemModalProps) {
  const t = useTranslations();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("question");
  const [contentId, setContentId] = useState("");
  const [contentLabel, setContentLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Question specific filters
  const [examFilter, setExamFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [topicFilters, setTopicFilters] = useState<{ id: string; name: string }[]>([]);
  const [showTopicFilter, setShowTopicFilter] = useState(false);

  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);

  useEffect(() => {
    if (contentType === "question") {
      listExams(1, 200).then((res) => setExams(res.data ?? []));
      listInstitutions(1, 200).then((res) => setInstitutions(res.data ?? []));
    }
  }, [contentType]);

  useEffect(() => {
    setContentId("");
    setContentLabel("");
    setSearchQuery("");
    setSearchPage(1);
    setTotalPages(1);
    setExamFilter("");
    setInstitutionFilter("");
    setTopicFilters([]);
  }, [contentType]);

  const fetchResults = useCallback(async () => {
    setSearching(true);
    try {
      if (contentType === "question") {
        const filter: any = {};
        if (searchQuery.trim()) filter.statement = searchQuery.trim();
        if (topicFilters.length > 0) filter.topic_id = topicFilters.map(t => t.id);
        if (examFilter) filter.exam_id = examFilter;
        if (institutionFilter) filter.institution_id = institutionFilter;
        const res = await listQuestions(searchPage, 10, Object.keys(filter).length > 0 ? filter : undefined);
        setSearchResults(res.data ?? []);
        setTotalPages(res.total_pages || 1);
      } else if (contentType === "video_lesson") {
        const q = searchQuery.trim();
        const res = await listVideoLessons(searchPage, 10, q ? { title: q } : undefined);
        setSearchResults(res.data ?? []);
        setTotalPages(res.total_pages || 1);
      } else if (contentType === "handout") {
        const q = searchQuery.trim();
        const res = await listHandouts(searchPage, 10, q ? { title: q } : undefined);
        setSearchResults(res.data ?? []);
        setTotalPages(res.total_pages || 1);
      } else if (contentType === "open_exercise_list") {
        const q = searchQuery.trim();
        const res = await listExerciseLists(searchPage, 10, q ? { title: q } : undefined);
        setSearchResults(res.data ?? []);
        setTotalPages(res.total_pages || 1);
      } else if (contentType === "simulated_exam") {
        // Exams do not have backend search/pagination by query right now, fallback to client filter
        const res = await listExams(1, 200);
        let items = res.data ?? [];
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          items = items.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              e.institution?.name?.toLowerCase().includes(q)
          );
        }
        // Client side pagination
        const perPage = 10;
        setTotalPages(Math.ceil(items.length / perPage) || 1);
        setSearchResults(items.slice((searchPage - 1) * perPage, searchPage * perPage));
      }
    } catch {
      setSearchResults([]);
      setTotalPages(1);
    } finally {
      setSearching(false);
    }
  }, [contentType, searchQuery, searchPage, examFilter, institutionFilter, topicFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResults();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  function handleSelect(item: any) {
    setContentId(item.id);
    if (contentType === "question") {
      let label = stripImageMarkers(item.statement || "");
      if (label.length > 80) label = label.substring(0, 80) + "...";
      setContentLabel(label);
    } else if (contentType === "simulated_exam") {
      setContentLabel(`${item.title} — ${item.institution?.name ?? ""} (${item.year})`);
    } else {
      setContentLabel(item.title);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const input: CreateActivityItemInput = {
        title: title.trim(),
        description: description.trim() || undefined,
      };

      if (!contentId.trim()) {
        setError(t("ACTIVITY_ITEM_CONTENT_REQUIRED"));
        setLoading(false);
        return;
      }

      const id = contentId.trim();
      switch (contentType) {
        case "question":
          input.question_id = id;
          break;
        case "video_lesson":
          input.video_lesson_id = id;
          break;
        case "handout":
          input.handout_id = id;
          break;
        case "open_exercise_list":
          input.open_exercise_list_id = id;
          break;
        case "simulated_exam":
          input.simulated_exam_id = id;
          break;
      }

      await createActivityItem(activityId, input);
      onCreated();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
            defaultValue: err.message,
          }),
        );
      } else {
        setError(t("ERROR_INTERNAL_ERROR"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-xl border border-surface-border bg-surface shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("ACTIVITY_ITEM_CREATE_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
            {/* Left Column: Form Info */}
            <div className="space-y-4">
              <form id="create-item-form" onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  label={t("ACTIVITY_ITEM_TITLE_LABEL")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("ACTIVITY_ITEM_TITLE_PLACEHOLDER")}
                  required
                  autoFocus
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    {t("ACTIVITY_ITEM_DESCRIPTION_LABEL")}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("ACTIVITY_ITEM_DESCRIPTION_PLACEHOLDER")}
                    rows={3}
                    className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                  <p className="mt-1 text-xs text-muted">
                    {t("QUESTION_LATEX_HINT")}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    {t("ACTIVITY_ITEM_TYPE_LABEL")}
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-body outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                  >
                    <option value="question">{t("ACTIVITY_ITEM_TYPE_QUESTION")}</option>
                    <option value="video_lesson">{t("ACTIVITY_ITEM_TYPE_VIDEO_LESSON")}</option>
                    <option value="handout">{t("ACTIVITY_ITEM_TYPE_HANDOUT")}</option>
                    <option value="open_exercise_list">{t("ACTIVITY_ITEM_TYPE_OPEN_EXERCISE_LIST")}</option>
                    <option value="simulated_exam">{t("ACTIVITY_ITEM_TYPE_SIMULATED_EXAM")}</option>
                  </select>
                </div>
              </form>

              {contentId && (
                <div className="rounded-lg border border-secondary/40 bg-secondary/5 p-4">
                  <span className="mb-2 block text-xs font-semibold text-secondary uppercase">
                    {t("ACTIVITY_ITEM_CONTENT_LABEL")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-secondary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-heading font-medium">
                      {contentLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setContentId("");
                        setContentLabel("");
                      }}
                      className="shrink-0 rounded p-0.5 text-muted hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-error">{error}</p>}
            </div>

            {/* Right Column: Search Grid */}
            <div className="flex h-full flex-col min-h-[400px] border border-surface-border rounded-xl bg-background/50 p-4">
              <div className="mb-4 flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchPage(1);
                    }}
                    placeholder={t("ACTIVITY_ITEM_SEARCH_PLACEHOLDER")}
                    className="w-full rounded-lg border border-surface-border bg-surface py-2.5 pl-9 pr-9 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
                  )}
                </div>

                {contentType === "question" && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <select
                      value={examFilter}
                      onChange={(e) => {
                        setExamFilter(e.target.value);
                        setSearchPage(1);
                      }}
                      className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-muted outline-none transition-colors focus:border-secondary focus:ring-1 hover:border-secondary"
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
                      onChange={(e) => {
                        setInstitutionFilter(e.target.value);
                        setSearchPage(1);
                      }}
                      className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-muted outline-none transition-colors focus:border-secondary focus:ring-1 hover:border-secondary"
                    >
                      <option value="">{t("QUESTION_ALL_INSTITUTIONS")}</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name} ({inst.acronym})
                        </option>
                      ))}
                    </select>

                    {topicFilters.length > 0 ? (
                      <div className="flex flex-wrap gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-3">
                        {topicFilters.map(t => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTopicFilters(prev => prev.filter(p => p.id !== t.id));
                              setSearchPage(1);
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-secondary/10 px-3 py-2 text-sm text-secondary hover:bg-secondary/20 transition-colors"
                          >
                            <span className="truncate">{t.name}</span>
                            <X className="h-3.5 w-3.5 shrink-0" />
                          </button>
                        ))}
                        <button
                          onClick={() => setShowTopicFilter(true)}
                          className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border bg-surface px-3 py-2 text-sm text-muted hover:border-secondary transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="truncate">{t("QUESTION_FILTER_BY_TOPIC")}</span>
                        </button>
                        <FilterTooltip />
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-2">
                        <button
                          onClick={() => setShowTopicFilter(true)}
                          className="flex flex-1 items-center justify-between rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-muted hover:border-secondary transition-colors"
                        >
                          <span className="truncate">{t("QUESTION_FILTER_BY_TOPIC")}</span>
                        </button>
                        <FilterTooltip />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {searchResults.length === 0 && !searching ? (
                  <div className="flex h-full items-center justify-center p-8 text-center text-muted">
                    {t("ACTIVITY_ITEM_SEARCH_NO_RESULTS")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((item) => {
                      const isSelected = contentId === item.id;
                      let label = item.title;
                      let subtitle = null;

                      if (contentType === "question") {
                        label = stripImageMarkers(item.statement);
                        if (item.exam) {
                          subtitle = `${item.exam.institution_acronym || item.exam.institution} · ${item.exam.title} (${item.exam.year})`;
                        } else {
                          subtitle = t("ACTIVITY_ITEM_TYPE_QUESTION");
                        }
                      } else if (contentType === "simulated_exam") {
                        subtitle = `${item.institution?.name ?? ""} (${item.year})`;
                      }

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={`cursor-pointer rounded-lg border p-3 transition-colors ${isSelected
                            ? "border-secondary bg-secondary/10"
                            : "border-surface-border bg-surface hover:border-secondary/50 hover:bg-surface-light"
                            }`}
                        >
                          <div className="flex gap-3">
                            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-secondary bg-secondary text-white" : "border-muted"
                              }`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              {contentType === "question" ? (
                                <LatexText text={label} as="p" className={`text-sm font-medium line-clamp-2 ${isSelected ? 'text-secondary-light' : 'text-heading'}`} />
                              ) : (
                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-secondary-light' : 'text-heading'}`}>
                                  {label}
                                </p>
                              )}

                              {subtitle && (
                                <p className="mt-1 text-xs text-muted truncate">{subtitle}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2 border-t border-surface-border pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={searchPage <= 1}
                    onClick={() => setSearchPage((p) => p - 1)}
                  >
                    {t("QUESTION_PAGE_PREV")}
                  </Button>
                  <span className="text-sm text-muted">
                    {searchPage} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={searchPage >= totalPages}
                    onClick={() => setSearchPage((p) => p + 1)}
                  >
                    {t("QUESTION_PAGE_NEXT")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-surface-border bg-surface/50 p-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            {t("PROFILE_CANCEL")}
          </Button>
          <Button
            type="submit"
            form="create-item-form"
            loading={loading}
            disabled={!contentId}
            className="flex-1 shadow-[0_0_15px_rgba(207,161,86,0.2)]"
          >
            {t("ACTIVITY_ITEM_CREATE_SUBMIT")}
          </Button>
        </div>

        {showTopicFilter && (
          <TopicPickerModal
            selected={topicFilters}
            onConfirm={(topics) => {
              setTopicFilters(topics);
              setShowTopicFilter(false);
              setSearchPage(1);
            }}
            onClose={() => setShowTopicFilter(false)}
          />
        )}
      </div>
    </div>
  );
}

export { CreateItemModal };
