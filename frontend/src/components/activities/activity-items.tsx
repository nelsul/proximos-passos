"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Loader2,
  GripVertical,
  Trash2,
  Pencil,
  ListChecks,
  HelpCircle,
  Video,
  FileText,
  BookOpen,
  X,
  Search,
  Check,
} from "lucide-react";
import {
  listActivityItems,
  createActivityItem,
  updateActivityItem,
  deleteActivityItem,
  reorderActivityItems,
  type ActivityItemResponse,
  type CreateActivityItemInput,
} from "@/lib/activities";
import { listQuestions } from "@/lib/questions";
import { listVideoLessons } from "@/lib/video-lessons";
import { listHandouts } from "@/lib/handouts";
import { listExerciseLists } from "@/lib/open-exercise-lists";
import { listExams } from "@/lib/exams";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { LatexText } from "@/components/ui/latex-text";
import { useToast } from "@/components/ui/toast";

interface ActivityItemsProps {
  activityId: string;
  isAdmin: boolean;
}

const TYPE_ICONS: Record<string, typeof HelpCircle> = {
  question: HelpCircle,
  video_lesson: Video,
  handout: FileText,
  open_exercise_list: BookOpen,
  simulated_exam: ListChecks,
};

const TYPE_COLORS: Record<string, string> = {
  question: "text-purple-400",
  video_lesson: "text-blue-400",
  handout: "text-secondary",
  open_exercise_list: "text-green-400",
  simulated_exam: "text-amber-400",
};

export function ActivityItems({ activityId, isAdmin }: ActivityItemsProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivityItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<ActivityItemResponse | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchItems = useCallback(async () => {
    try {
      const data = await listActivityItems(activityId);
      setItems(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    try {
      await reorderActivityItems(
        activityId,
        newItems.map((i) => i.id),
      );
    } catch {
      // Revert on error
      await fetchItems();
    }
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    try {
      await deleteActivityItem(itemId);
      toast(t("ACTIVITY_ITEM_DELETE_SUCCESS"));
      await fetchItems();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(t(`ERROR_${err.code}`), "error");
      }
    } finally {
      setDeletingId(null);
    }
  }

  function handleCreated() {
    setShowCreate(false);
    toast(t("ACTIVITY_ITEM_CREATE_SUCCESS"));
    fetchItems();
  }

  function handleUpdated() {
    setEditingItem(null);
    toast(t("ACTIVITY_ITEM_UPDATE_SUCCESS"));
    fetchItems();
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
          <ListChecks className="h-5 w-5 text-secondary" />
          {t("ACTIVITY_ITEMS_TITLE")}
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {t("ACTIVITY_ITEM_ADD")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t("ACTIVITY_ITEMS_EMPTY")}
        </p>
      ) : isAdmin ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item, idx) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  index={idx}
                  onEdit={() => setEditingItem(item)}
                  onDelete={() => handleDelete(item.id)}
                  deleting={deletingId === item.id}
                  isAdmin={isAdmin}
                  t={t}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <ItemRow key={item.id} item={item} index={idx} t={t} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateItemModal
          activityId={activityId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

// ==========================================
// Sortable Item (admin DnD)
// ==========================================

interface SortableItemProps {
  item: ActivityItemResponse;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  isAdmin: boolean;
  t: ReturnType<typeof useTranslations>;
}

function SortableItem({
  item,
  index,
  onEdit,
  onDelete,
  deleting,
  t,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = TYPE_ICONS[item.type] ?? ListChecks;
  const color = TYPE_COLORS[item.type] ?? "text-muted";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-surface-border bg-background p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted hover:text-heading active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-light text-xs font-semibold text-muted">
        {index + 1}
      </span>

      <Icon className={`h-4 w-4 shrink-0 ${color}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-heading truncate">
          {item.title}
        </p>
        {item.description && (
          <LatexText
            text={item.description}
            as="p"
            className="mt-0.5 text-xs text-muted line-clamp-2"
          />
        )}
      </div>

      <span className="shrink-0 rounded-full bg-surface-light px-2 py-0.5 text-[10px] font-medium text-muted uppercase">
        {t(
          `ACTIVITY_ITEM_TYPE_${item.type.toUpperCase()}` as Parameters<
            typeof t
          >[0],
          { defaultValue: item.type },
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-muted hover:text-heading hover:bg-surface-light transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Read-only Item Row (non-admin)
// ==========================================

interface ItemRowProps {
  item: ActivityItemResponse;
  index: number;
  t: ReturnType<typeof useTranslations>;
}

function ItemRow({ item, index, t }: ItemRowProps) {
  const Icon = TYPE_ICONS[item.type] ?? ListChecks;
  const color = TYPE_COLORS[item.type] ?? "text-muted";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-background p-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-light text-xs font-semibold text-muted">
        {index + 1}
      </span>

      <Icon className={`h-4 w-4 shrink-0 ${color}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-heading truncate">
          {item.title}
        </p>
        {item.description && (
          <LatexText
            text={item.description}
            as="p"
            className="mt-0.5 text-xs text-muted line-clamp-2"
          />
        )}
      </div>

      <span className="shrink-0 rounded-full bg-surface-light px-2 py-0.5 text-[10px] font-medium text-muted uppercase">
        {t(
          `ACTIVITY_ITEM_TYPE_${item.type.toUpperCase()}` as Parameters<
            typeof t
          >[0],
          { defaultValue: item.type },
        )}
      </span>
    </div>
  );
}

// ==========================================
// Content search helper
// ==========================================

interface ContentSearchResult {
  id: string;
  label: string;
}

async function searchContent(
  type: string,
  query: string,
): Promise<ContentSearchResult[]> {
  switch (type) {
    case "question": {
      const res = await listQuestions(1, 10, { statement: query });
      return (res.data ?? []).map((q) => ({
        id: q.id,
        label:
          q.statement.length > 80
            ? q.statement.slice(0, 80) + "…"
            : q.statement,
      }));
    }
    case "video_lesson": {
      const res = await listVideoLessons(1, 10, { title: query });
      return (res.data ?? []).map((v) => ({ id: v.id, label: v.title }));
    }
    case "handout": {
      const res = await listHandouts(1, 10, { title: query });
      return (res.data ?? []).map((h) => ({ id: h.id, label: h.title }));
    }
    case "open_exercise_list": {
      const res = await listExerciseLists(1, 10, { title: query });
      return (res.data ?? []).map((e) => ({ id: e.id, label: e.title }));
    }
    case "simulated_exam": {
      const res = await listExams(1, 10);
      return (res.data ?? [])
        .filter(
          (e) =>
            e.title.toLowerCase().includes(query.toLowerCase()) ||
            e.institution?.name?.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 10)
        .map((e) => ({
          id: e.id,
          label: `${e.title} — ${e.institution?.name ?? ""} (${e.year})`,
        }));
    }
    default:
      return [];
  }
}

// ==========================================
// Create Item Modal
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

  // Content search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset content selection when type changes
  useEffect(() => {
    setContentId("");
    setContentLabel("");
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  }, [contentType]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchContent(contentType, searchQuery.trim());
        setSearchResults(results);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, contentType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectContent(item: ContentSearchResult) {
    setContentId(item.id);
    setContentLabel(item.label);
    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
  }

  function clearSelection() {
    setContentId("");
    setContentLabel("");
    setSearchQuery("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
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

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
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
              <option value="question">
                {t("ACTIVITY_ITEM_TYPE_QUESTION")}
              </option>
              <option value="video_lesson">
                {t("ACTIVITY_ITEM_TYPE_VIDEO_LESSON")}
              </option>
              <option value="handout">{t("ACTIVITY_ITEM_TYPE_HANDOUT")}</option>
              <option value="open_exercise_list">
                {t("ACTIVITY_ITEM_TYPE_OPEN_EXERCISE_LIST")}
              </option>
              <option value="simulated_exam">
                {t("ACTIVITY_ITEM_TYPE_SIMULATED_EXAM")}
              </option>
            </select>
          </div>

          {/* Content search */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">
              {t("ACTIVITY_ITEM_CONTENT_LABEL")}
            </label>

            {contentId ? (
              <div className="flex items-center gap-2 rounded-lg border border-secondary/40 bg-secondary/5 px-3 py-2.5">
                <Check className="h-4 w-4 shrink-0 text-secondary" />
                <span className="min-w-0 flex-1 truncate text-sm text-heading">
                  {contentLabel}
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 rounded p-0.5 text-muted hover:text-heading transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={resultsRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowResults(true);
                    }}
                    placeholder={t("ACTIVITY_ITEM_SEARCH_PLACEHOLDER")}
                    className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-9 pr-9 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
                  )}
                </div>

                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-surface-border bg-surface shadow-lg">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectContent(item)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-body hover:bg-surface-light transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        <span className="shrink-0 text-[10px] font-mono text-muted">
                          {item.id.slice(0, 8)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {showResults &&
                  searchQuery.trim() &&
                  !searching &&
                  searchResults.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-3 text-center text-sm text-muted shadow-lg">
                      {t("ACTIVITY_ITEM_SEARCH_NO_RESULTS")}
                    </div>
                  )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("PROFILE_CANCEL")}
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {t("ACTIVITY_ITEM_CREATE_SUBMIT")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Edit Item Modal
// ==========================================

interface EditItemModalProps {
  item: ActivityItemResponse;
  onClose: () => void;
  onUpdated: () => void;
}

function EditItemModal({ item, onClose, onUpdated }: EditItemModalProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await updateActivityItem(item.id, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onUpdated();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("ACTIVITY_ITEM_EDIT_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
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

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("PROFILE_CANCEL")}
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {t("PROFILE_SAVE")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
