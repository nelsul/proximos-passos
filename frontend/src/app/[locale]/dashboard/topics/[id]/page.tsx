"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { ArrowLeft, Edit2, Layers, Loader2, Plus, Trash2 } from "lucide-react";
import {
  getTopic,
  listTopics,
  deleteTopic,
  updateTopic,
  type TopicResponse,
} from "@/lib/topics";
import { ApiRequestError } from "@/lib/api";
import { CreateTopicModal } from "@/components/topics/create-topic-modal";
import { EditTopicModal } from "@/components/topics/edit-topic-modal";
import { TopicTreeNode } from "@/components/topics/topic-tree-node";
import {
  TopicDragProvider,
  useTopicDrag,
} from "@/components/topics/topic-drag-context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useIsAdmin } from "@/contexts/user-context";

export default function TopicDetailPage() {
  return (
    <TopicDragProvider>
      <TopicDetailContent />
    </TopicDragProvider>
  );
}

function TopicDetailContent() {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const params = useParams<{ id: string }>();
  const topicId = params.id;
  const { draggedTopic, removedChildId, notifyMoved, clearMoved, endDrag } =
    useTopicDrag();

  const [topic, setTopic] = useState<TopicResponse | null>(null);
  const [children, setChildren] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasSubtopics, setHasSubtopics] = useState(false);
  const [headerDragOver, setHeaderDragOver] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [topicData, childrenData] = await Promise.all([
        getTopic(topicId),
        listTopics(1, 100, { parent_id: topicId }),
      ]);
      setTopic(topicData);
      setChildren(childrenData.data ?? []);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "TOPIC_NOT_FOUND") {
        setTopic(null);
      }
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Remove moved topic from page-level children
  useEffect(() => {
    if (removedChildId) {
      setChildren((prev) => prev.filter((c) => c.id !== removedChildId));
    }
  }, [removedChildId]);

  // Header drop zone — dropping here makes the topic a direct child of this topic
  function isValidHeaderDrop(): boolean {
    if (!draggedTopic) return false;
    if (draggedTopic.id === topicId) return false;
    if (draggedTopic.parent_id === topicId) return false;
    return true;
  }

  function handleHeaderDragOver(e: React.DragEvent) {
    if (!isValidHeaderDrop()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHeaderDragOver(true);
  }

  function handleHeaderDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setHeaderDragOver(false);
  }

  async function handleHeaderDrop(e: React.DragEvent) {
    e.preventDefault();
    setHeaderDragOver(false);
    if (!isValidHeaderDrop() || !draggedTopic) return;

    try {
      await updateTopic(draggedTopic.id, { parent_id: topicId });
      notifyMoved(draggedTopic.id);
      const res = await listTopics(1, 100, { parent_id: topicId });
      setChildren(res.data ?? []);
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

  function handleChildCreated() {
    setShowCreate(false);
    toast(t("TOPIC_CREATE_SUCCESS"));
    fetchData();
  }

  function handleUpdated(updated: TopicResponse) {
    setShowEdit(false);
    setTopic(updated);
    toast(t("TOPIC_UPDATE_SUCCESS"));
  }

  function handleChildUpdated(updated: TopicResponse) {
    setChildren((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleChildDeleted(id: string) {
    setChildren((prev) => prev.filter((c) => c.id !== id));
  }

  function handleDeleteClick() {
    setHasSubtopics(children.length > 0);
    setConfirmDelete(true);
  }

  async function handleDelete(mode?: "cascade" | "reparent") {
    setDeleting(true);
    try {
      await deleteTopic(topicId, mode);
      toast(t("TOPIC_DELETE_SUCCESS"));
      if (topic?.parent_id) {
        router.push(`/dashboard/topics/${topic.parent_id}`);
      } else {
        router.push("/dashboard/topics");
      }
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
        <p className="text-muted">{t("TOPIC_NOT_FOUND")}</p>
        <Link
          href="/dashboard/topics"
          className="mt-4 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("TOPIC_BACK_TO_TOPICS")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/dashboard/topics"
          className="inline-flex items-center gap-1 text-sm text-secondary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("TOPIC_BACK_TO_TOPICS")}
        </Link>
      </div>

      {/* Topic header — also a drop target */}
      <div
        className={`mb-6 rounded-lg border bg-surface p-6 transition-colors ${
          headerDragOver
            ? "border-secondary ring-2 ring-secondary bg-secondary/5"
            : "border-surface-border"
        }`}
        onDragOver={handleHeaderDragOver}
        onDragLeave={handleHeaderDragLeave}
        onDrop={handleHeaderDrop}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-heading">{topic.name}</h1>
            {topic.description && (
              <p className="mt-2 text-sm text-muted">{topic.description}</p>
            )}
          </div>
          {isAdmin && (
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setShowEdit(true)}
                className="rounded-lg border border-surface-border p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                title={t("TOPIC_EDIT_TITLE")}
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleDeleteClick}
                className="rounded-lg border border-surface-border p-2 text-muted transition-colors hover:bg-error/10 hover:text-error"
                title={t("TOPIC_DELETE_BUTTON")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Subtopics tree */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading">
          {t("TOPIC_CHILDREN_TITLE")}
        </h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("TOPIC_CREATE_BUTTON")}
          </Button>
        )}
      </div>

      {children.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("TOPIC_CHILDREN_EMPTY")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-surface-border bg-surface py-1">
          {children.map((child) => (
            <TopicTreeNode
              key={child.id}
              topic={child}
              depth={0}
              onDeleted={handleChildDeleted}
              onUpdated={handleChildUpdated}
              ancestorIds={[topicId]}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateTopicModal
          parentId={topicId}
          onClose={() => setShowCreate(false)}
          onCreated={handleChildCreated}
        />
      )}

      {showEdit && (
        <EditTopicModal
          topic={topic}
          onClose={() => setShowEdit(false)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Delete confirmation */}
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
