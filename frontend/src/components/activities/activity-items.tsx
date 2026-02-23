"use client";

import { useState, useEffect, useCallback } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Loader2, ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import {
  listActivityItems,
  reorderActivityItems,
  deleteActivityItem,
  type ActivityItemResponse,
} from "@/lib/activities";
import { ApiRequestError } from "@/lib/api";
import {
  getQuestionStatuses,
  type QuestionStatusResponse,
} from "@/lib/activity-submissions";
import { useToast } from "@/components/ui/toast";
import { CreateItemModal } from "./items/create-item-modal";
import { EditItemModal } from "./items/edit-item-modal";
import { SortableItem } from "./items/sortable-item";
import { ItemRow } from "./items/item-row";

interface ActivityItemsProps {
  activityId: string;
  isAdmin: boolean;
}

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
  const [questionStatuses, setQuestionStatuses] = useState<
    Record<string, QuestionStatusResponse>
  >({});
  const [isExpanded, setIsExpanded] = useState(true);

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

  // Fetch question answer statuses for non-admin users
  useEffect(() => {
    if (isAdmin) return;
    getQuestionStatuses(activityId)
      .then((statuses) => {
        if (!statuses) return;
        const map: Record<string, QuestionStatusResponse> = {};
        for (const s of statuses) {
          map[s.question_id] = s;
        }
        setQuestionStatuses(map);
      })
      .catch(() => { });
  }, [activityId, isAdmin]);

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
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group flex items-center gap-2 text-lg font-semibold text-heading hover:text-secondary transition-colors"
        >
          <ListChecks className="h-5 w-5 text-secondary" />
          {t("ACTIVITY_ITEMS_TITLE")}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted group-hover:text-secondary transition-colors" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted group-hover:text-secondary transition-colors" />
          )}
        </button>
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

      {isExpanded && (
        <>
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
            <ItemRow
              key={item.id}
              item={item}
              index={idx}
              activityId={activityId}
              questionStatus={
                item.question_id
                  ? questionStatuses[item.question_id]
                  : undefined
              }
              t={t}
            />
          ))}
        </div>
      )}
        </>
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