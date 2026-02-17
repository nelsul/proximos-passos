"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  Building2,
  HelpCircle,
  Loader2,
  Layers,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  getInstitutionDetails,
  type InstitutionDetailResponse,
} from "@/lib/institutions";
import { listTopics, type TopicResponse } from "@/lib/topics";

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

interface TreeNode {
  topic: TopicResponse;
  children: TreeNode[];
}

function buildTree(topics: TopicResponse[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const t of topics) {
    map.set(t.id, { topic: t, children: [] });
  }

  for (const t of topics) {
    const node = map.get(t.id)!;
    if (t.parent_id && map.has(t.parent_id)) {
      map.get(t.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function computeExpandedIds(
  topics: TopicResponse[],
  highlightIds: Set<string>,
): Set<string> {
  const expanded = new Set<string>();
  const parentMap = new Map<string, string>();

  for (const t of topics) {
    if (t.parent_id) parentMap.set(t.id, t.parent_id);
  }

  for (const id of highlightIds) {
    let current = parentMap.get(id);
    while (current) {
      expanded.add(current);
      current = parentMap.get(current);
    }
  }

  return expanded;
}

// ---------------------------------------------------------------------------
// Tree Node component (read-only)
// ---------------------------------------------------------------------------

function ReadOnlyTreeNode({
  node,
  depth,
  highlightIds,
  expandedIds,
}: {
  node: TreeNode;
  depth: number;
  highlightIds: Set<string>;
  expandedIds: Set<string>;
}) {
  const isHighlighted = highlightIds.has(node.topic.id);
  const shouldAutoExpand =
    expandedIds.has(node.topic.id) || highlightIds.has(node.topic.id);
  const [expanded, setExpanded] = useState(shouldAutoExpand);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((p) => !p)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          isHighlighted
            ? "bg-secondary/10 font-medium text-secondary"
            : "text-body hover:bg-surface-light"
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Layers
          className={`h-3.5 w-3.5 shrink-0 ${isHighlighted ? "text-secondary" : "text-muted"}`}
        />
        <span className="truncate">{node.topic.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ReadOnlyTreeNode
              key={child.topic.id}
              node={child}
              depth={depth + 1}
              highlightIds={highlightIds}
              expandedIds={expandedIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InstitutionDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const institutionId = params.id;

  const [detail, setDetail] = useState<InstitutionDetailResponse | null>(null);
  const [allTopics, setAllTopics] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instDetail, topicsRes] = await Promise.all([
        getInstitutionDetails(institutionId),
        listTopics(1, 500),
      ]);
      setDetail(instDetail);
      setAllTopics(topicsRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const highlightIds = useMemo(
    () => new Set(detail?.topic_ids ?? []),
    [detail],
  );

  const expandedIds = useMemo(
    () => computeExpandedIds(allTopics, highlightIds),
    [allTopics, highlightIds],
  );

  const tree = useMemo(() => buildTree(allTopics), [allTopics]);

  function filterTree(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map((node) => {
        const filteredChildren = filterTree(node.children);
        const isRelevant =
          highlightIds.has(node.topic.id) || filteredChildren.length > 0;
        if (!isRelevant) return null;
        return { ...node, children: filteredChildren };
      })
      .filter(Boolean) as TreeNode[];
  }

  const filteredTree = useMemo(
    () => filterTree(tree),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree, highlightIds],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
        <p className="text-muted">{t("ERROR_INSTITUTION_NOT_FOUND")}</p>
      </div>
    );
  }

  const institution = detail.institution;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/institutions`)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("INSTITUTION_DETAIL_BACK")}
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
            <Building2 className="h-6 w-6 text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-heading">
              {institution.name} ({institution.acronym})
            </h1>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Question count card - clickable */}
        <button
          onClick={() =>
            router.push(
              `/${locale}/dashboard/questions?institution_id=${institution.id}`,
            )
          }
          className="flex items-center gap-4 rounded-xl border border-surface-border bg-surface p-5 text-left transition-colors hover:border-secondary hover:bg-surface-light"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
            <HelpCircle className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-heading">
              {detail.question_count}
            </p>
            <p className="text-sm text-muted">
              {t("INSTITUTION_DETAIL_QUESTIONS")}
            </p>
          </div>
        </button>

        {/* Topic count card */}
        <div className="flex items-center gap-4 rounded-xl border border-surface-border bg-surface p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
            <Layers className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-heading">
              {detail.topic_ids?.length ?? 0}
            </p>
            <p className="text-sm text-muted">
              {t("INSTITUTION_DETAIL_TOPICS")}
            </p>
          </div>
        </div>
      </div>

      {/* Topic tree */}
      <div className="rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold text-heading">
          {t("INSTITUTION_DETAIL_TOPIC_TREE")}
        </h2>

        {filteredTree.length === 0 ? (
          <div className="py-8 text-center">
            <Layers className="mx-auto mb-3 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">
              {t("INSTITUTION_DETAIL_NO_TOPICS")}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map((node) => (
              <ReadOnlyTreeNode
                key={node.topic.id}
                node={node}
                depth={0}
                highlightIds={highlightIds}
                expandedIds={expandedIds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
