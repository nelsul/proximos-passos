"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  Layers,
  Loader2,
  Search,
  X,
  Check,
} from "lucide-react";
import { listTopics, type TopicResponse } from "@/lib/topics";
import { Button } from "@/components/ui/button";

interface SelectedTopic {
  id: string;
  name: string;
}

interface TopicPickerModalProps {
  selected: SelectedTopic[];
  onConfirm: (topics: SelectedTopic[]) => void;
  onClose: () => void;
}

export function TopicPickerModal({
  selected,
  onConfirm,
  onClose,
}: TopicPickerModalProps) {
  const t = useTranslations();
  const [roots, setRoots] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TopicResponse[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [currentSelected, setCurrentSelected] = useState<SelectedTopic[]>(selected);

  const selectedIds = new Set(currentSelected.map((s) => s.id));

  const fetchRoots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTopics(1, 100, { parent_id: "" });
      setRoots(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoots();
  }, [fetchRoots]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await listTopics(1, 50, { name: search.trim() });
        setSearchResults(res.data ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function handleSelect(topic: TopicResponse) {
    if (selectedIds.has(topic.id)) {
      setCurrentSelected((prev) => prev.filter((t) => t.id !== topic.id));
    } else {
      setCurrentSelected((prev) => [...prev, { id: topic.id, name: topic.name }]);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-surface-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("TOPIC_PICKER_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-surface-border px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("TOPIC_SEARCH_PLACEHOLDER")}
              autoFocus
              className="w-full rounded-lg border border-surface-border bg-background py-2 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>
        </div>

        {/* Tree content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : searchResults !== null ? (
            // Search results (flat list)
            searching ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                {t("TOPIC_NOT_FOUND")}
              </p>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map((topic) => (
                  <TopicRow
                    key={topic.id}
                    topic={topic}
                    isSelected={selectedIds.has(topic.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )
          ) : roots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {t("TOPICS_EMPTY")}
            </p>
          ) : (
            // Tree view
            <div className="space-y-0.5">
              {roots.map((topic) => (
                <PickerTreeNode
                  key={topic.id}
                  topic={topic}
                  depth={0}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-border px-6 py-4 flex justify-between gap-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            {t("TOPIC_PICKER_CLOSE")}
          </Button>
          <Button onClick={() => onConfirm(currentSelected)} className="w-full">
            {t("TOPIC_PICKER_CONFIRM")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Single topic row (used in search results)
// ==========================================

function TopicRow({
  topic,
  isSelected,
  onSelect,
}: {
  topic: TopicResponse;
  isSelected: boolean;
  onSelect: (t: TopicResponse) => void;
}) {
  return (
    <button
      onClick={() => onSelect(topic)}
      disabled={isSelected}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        isSelected
          ? "bg-secondary/10 text-secondary cursor-default"
          : "text-heading hover:bg-surface-light"
      }`}
    >
      <Layers className="h-4 w-4 shrink-0 text-secondary" />
      <span className="min-w-0 flex-1 truncate">{topic.name}</span>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-secondary" />}
    </button>
  );
}

// ==========================================
// Recursive tree node for the picker
// ==========================================

function PickerTreeNode({
  topic,
  depth,
  selectedIds,
  onSelect,
}: {
  topic: TopicResponse;
  depth: number;
  selectedIds: Set<string>;
  onSelect: (t: TopicResponse) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TopicResponse[] | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(false);

  const isSelected = selectedIds.has(topic.id);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!expanded) {
      if (children === null) {
        setLoadingChildren(true);
        try {
          const res = await listTopics(1, 100, { parent_id: topic.id });
          setChildren(res.data ?? []);
        } finally {
          setLoadingChildren(false);
        }
      }
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg py-1.5 pr-2 transition-colors ${
          isSelected
            ? "bg-secondary/10"
            : "hover:bg-surface-light cursor-pointer"
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse */}
        <button
          onClick={handleToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-surface-border hover:text-heading"
        >
          {loadingChildren ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Selectable area */}
        <button
          onClick={() => onSelect(topic)}
          disabled={isSelected}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <Layers className="h-4 w-4 shrink-0 text-secondary" />
          <span
            className={`text-sm font-medium truncate ${isSelected ? "text-secondary" : "text-heading"}`}
          >
            {topic.name}
          </span>
          {topic.description && (
            <span className="hidden text-xs text-muted sm:inline truncate">
              {topic.description}
            </span>
          )}
        </button>

        {isSelected && <Check className="h-4 w-4 shrink-0 text-secondary" />}
      </div>

      {/* Children */}
      {expanded && children && (
        <div>
          {children.length === 0 ? (
            <div
              className="py-1 text-xs text-muted italic"
              style={{ paddingLeft: `${(depth + 1) * 20 + 36}px` }}
            >
              —
            </div>
          ) : (
            children.map((child) => (
              <PickerTreeNode
                key={child.id}
                topic={child}
                depth={depth + 1}
                selectedIds={selectedIds}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
