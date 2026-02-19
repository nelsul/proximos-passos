"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Loader2,
  Search,
  ListChecks,
  ExternalLink,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import {
  listExerciseLists,
  deleteExerciseList,
  type ExerciseListResponse,
} from "@/lib/open-exercise-lists";
import { CreateExerciseListModal } from "@/components/exercise-lists/create-exercise-list-modal";
import { EditExerciseListModal } from "@/components/exercise-lists/edit-exercise-list-modal";
import { TopicPickerModal } from "@/components/handouts/topic-picker-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useIsAdmin } from "@/contexts/user-context";

export default function ExerciseListsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [lists, setLists] = useState<ExerciseListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingList, setEditingList] = useState<ExerciseListResponse | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showTopicFilter, setShowTopicFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLists = useCallback(
    async (title?: string, topicId?: string, pageNum = 1) => {
      setLoading(true);
      try {
        const filter: { title?: string; topic_id?: string } = {};
        if (title) filter.title = title;
        if (topicId) filter.topic_id = topicId;
        const res = await listExerciseLists(
          pageNum,
          20,
          Object.keys(filter).length > 0 ? filter : undefined,
        );
        setLists(res.data ?? []);
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
      fetchLists(search || undefined, topicFilter?.id, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, topicFilter, fetchLists]);

  useEffect(() => {
    fetchLists(search || undefined, topicFilter?.id, page);
  }, [page, fetchLists, search, topicFilter]);

  function handleCreated() {
    setShowCreate(false);
    toast(t("EXERCISE_LIST_CREATE_SUCCESS"));
    fetchLists(search || undefined, topicFilter?.id, page);
  }

  function handleUpdated() {
    setEditingList(null);
    toast(t("EXERCISE_LIST_UPDATE_SUCCESS"));
    fetchLists(search || undefined, topicFilter?.id, page);
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteExerciseList(id);
      toast(t("EXERCISE_LIST_DELETE_SUCCESS"));
      fetchLists(search || undefined, topicFilter?.id, page);
    } finally {
      setDeletingId(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            {t("EXERCISE_LISTS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("EXERCISE_LISTS_SUBTITLE")}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("EXERCISE_LIST_CREATE_BUTTON")}
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
            placeholder={t("EXERCISE_LIST_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
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
            {t("EXERCISE_LIST_FILTER_BY_TOPIC")}
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
      ) : lists.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("EXERCISE_LISTS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface p-4 transition-colors hover:bg-surface-light"
              >
                <ListChecks className="h-5 w-5 shrink-0 text-secondary" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-heading">{list.title}</h3>
                  {list.description && (
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {list.description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {list.file && (
                      <>
                        <span>{list.file.filename}</span>
                        <span>·</span>
                        <span>{formatFileSize(list.file.size_bytes)}</span>
                      </>
                    )}
                    {list.file_url && !list.file && (
                      <span className="max-w-[200px] truncate">
                        {list.file_url}
                      </span>
                    )}
                    {list.topics.length > 0 && (
                      <>
                        {(list.file || list.file_url) && <span>·</span>}
                        {list.topics.map((topic) => (
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
                  {list.file_url && (
                    <a
                      href={list.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                      title={t("EXERCISE_LIST_OPEN_FILE")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setEditingList(list)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(list.id)}
                      disabled={deletingId === list.id}
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
                {t("EXERCISE_LIST_PAGE_PREV")}
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
                {t("EXERCISE_LIST_PAGE_NEXT")}
              </Button>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateExerciseListModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {editingList && (
        <EditExerciseListModal
          exerciseList={editingList}
          onClose={() => setEditingList(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
