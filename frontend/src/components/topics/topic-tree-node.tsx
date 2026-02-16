"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  Edit2,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  listTopics,
  deleteTopic,
  updateTopic,
  type TopicResponse,
} from "@/lib/topics";
import { ApiRequestError } from "@/lib/api";
import { CreateTopicModal } from "@/components/topics/create-topic-modal";
import { EditTopicModal } from "@/components/topics/edit-topic-modal";
import { useTopicDrag } from "@/components/topics/topic-drag-context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface TopicTreeNodeProps {
  topic: TopicResponse;
  depth: number;
  onDeleted: (id: string) => void;
  onUpdated: (topic: TopicResponse) => void;
  ancestorIds: string[];
}

export function TopicTreeNode({
  topic,
  depth,
  onDeleted,
  onUpdated,
  ancestorIds,
}: TopicTreeNodeProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const {
    draggedTopic,
    startDrag,
    endDrag,
    removedChildId,
    notifyMoved,
    clearMoved,
  } = useTopicDrag();

  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TopicResponse[] | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasSubtopics, setHasSubtopics] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Remove moved topic from own children when notified
  useEffect(() => {
    if (removedChildId) {
      setChildren((prev) =>
        prev ? prev.filter((c) => c.id !== removedChildId) : prev,
      );
    }
  }, [removedChildId]);

  const fetchChildren = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const res = await listTopics(1, 100, { parent_id: topic.id });
      setChildren(res.data ?? []);
    } finally {
      setLoadingChildren(false);
    }
  }, [topic.id]);

  async function handleToggle() {
    if (!expanded) {
      if (children === null) {
        await fetchChildren();
      }
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }

  function handleChildCreated() {
    setShowCreate(false);
    toast(t("TOPIC_CREATE_SUCCESS"));
    fetchChildren();
    if (!expanded) setExpanded(true);
  }

  function handleUpdatedSelf(updated: TopicResponse) {
    setShowEdit(false);
    onUpdated(updated);
    toast(t("TOPIC_UPDATE_SUCCESS"));
  }

  function handleChildUpdated(updated: TopicResponse) {
    setChildren((prev) =>
      prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev,
    );
  }

  function handleChildDeleted(id: string) {
    setChildren((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
  }

  async function handleDeleteClick() {
    if (children !== null) {
      setHasSubtopics(children.length > 0);
    } else {
      try {
        const res = await listTopics(1, 1, { parent_id: topic.id });
        setHasSubtopics((res.total_items ?? 0) > 0);
      } catch {
        setHasSubtopics(false);
      }
    }
    setConfirmDelete(true);
  }

  async function handleDelete(mode?: "cascade" | "reparent") {
    setDeleting(true);
    try {
      await deleteTopic(topic.id, mode);
      toast(t("TOPIC_DELETE_SUCCESS"));
      onDeleted(topic.id);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(
          t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
            defaultValue: err.message,
          }),
          "error",
        );
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // --- Drag and Drop ---

  const isBeingDragged = draggedTopic?.id === topic.id;

  function isValidDropTarget(): boolean {
    if (!draggedTopic) return false;
    if (draggedTopic.id === topic.id) return false;
    if (draggedTopic.parent_id === topic.id) return false;
    if (ancestorIds.includes(draggedTopic.id)) return false;
    return true;
  }

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", topic.id);
    startDrag(topic);
  }

  function handleDragEnd(e: React.DragEvent) {
    e.stopPropagation();
    endDrag();
  }

  function handleDragOver(e: React.DragEvent) {
    e.stopPropagation();
    if (!isValidDropTarget()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!isValidDropTarget() || !draggedTopic) return;

    try {
      await updateTopic(draggedTopic.id, { parent_id: topic.id });
      notifyMoved(draggedTopic.id);
      await fetchChildren();
      if (!expanded) setExpanded(true);
      clearMoved();
      endDrag();
      toast(t("TOPIC_MOVE_SUCCESS"));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast(
          t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
            defaultValue: err.message,
          }),
          "error",
        );
      } else {
        toast(t("ERROR_INTERNAL_ERROR"), "error");
      }
      endDrag();
    }
  }

  const hasLoadedChildren = children !== null && children.length > 0;
  const hasNoChildren = children !== null && children.length === 0;
  const showDropHighlight = isDragOver && isValidDropTarget();
  const childAncestorIds = [...ancestorIds, topic.id];

  return (
    <div>
      {/* Node row */}
      <div
        className={`group flex items-center gap-1 rounded-lg py-1.5 pr-2 transition-colors hover:bg-surface-light ${
          showDropHighlight ? "ring-2 ring-secondary bg-secondary/5" : ""
        } ${isBeingDragged ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag handle */}
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted/40" />

        {/* Expand/collapse toggle */}
        <button
          onClick={handleToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-surface-border hover:text-heading"
        >
          {loadingChildren ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : expanded && hasLoadedChildren ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Icon + name */}
        <Layers className="h-4 w-4 shrink-0 text-secondary" />
        <div className="ml-1 min-w-0 flex-1">
          <span className="text-sm font-medium text-heading">{topic.name}</span>
          {topic.description && (
            <span className="ml-2 text-xs text-muted">{topic.description}</span>
          )}
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded p-1 text-muted transition-colors hover:bg-surface-border hover:text-secondary"
            title={t("TOPIC_CREATE_BUTTON")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="rounded p-1 text-muted transition-colors hover:bg-surface-border hover:text-heading"
            title={t("TOPIC_EDIT_TITLE")}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="rounded p-1 text-muted transition-colors hover:bg-error/10 hover:text-error"
            title={t("TOPIC_DELETE_BUTTON")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {hasNoChildren && (
            <div
              className="py-1 text-xs text-muted italic"
              style={{ paddingLeft: `${(depth + 1) * 24 + 36}px` }}
            >
              {t("TOPIC_CHILDREN_EMPTY")}
            </div>
          )}
          {children?.map((child) => (
            <TopicTreeNode
              key={child.id}
              topic={child}
              depth={depth + 1}
              onDeleted={handleChildDeleted}
              onUpdated={handleChildUpdated}
              ancestorIds={childAncestorIds}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateTopicModal
          parentId={topic.id}
          onClose={() => setShowCreate(false)}
          onCreated={handleChildCreated}
        />
      )}

      {showEdit && (
        <EditTopicModal
          topic={topic}
          onClose={() => setShowEdit(false)}
          onUpdated={handleUpdatedSelf}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface p-6 shadow-2xl">
            <p className="mb-4 text-sm text-body">
              {hasSubtopics
                ? t("TOPIC_DELETE_CONFIRM_HAS_CHILDREN")
                : t("TOPIC_DELETE_CONFIRM")}
            </p>
            {hasSubtopics ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDelete("cascade")}
                  disabled={deleting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("TOPIC_DELETE_CASCADE")}
                </button>
                <button
                  onClick={() => handleDelete("reparent")}
                  disabled={deleting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary/90 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("TOPIC_DELETE_REPARENT")}
                </button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("PROFILE_CANCEL")}
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1"
                >
                  {t("PROFILE_CANCEL")}
                </Button>
                <button
                  onClick={() => handleDelete()}
                  disabled={deleting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("TOPIC_DELETE_BUTTON")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
