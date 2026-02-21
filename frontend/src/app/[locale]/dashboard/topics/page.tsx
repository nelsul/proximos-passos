"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Plus, Loader2, Search, Layers } from "lucide-react";
import { listTopics, type TopicResponse } from "@/lib/topics";
import { CreateTopicModal } from "@/components/topics/create-topic-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useIsAdmin } from "@/contexts/user-context";

export default function TopicsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const fetchTopics = useCallback(async (name?: string) => {
    setLoading(true);
    try {
      const res = await listTopics(1, 100, {
        parent_id: "",
        ...(name ? { name } : {}),
      });
      setTopics(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTopics(search || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchTopics]);

  function handleCreated() {
    setShowCreate(false);
    toast(t("TOPIC_CREATE_SUCCESS"));
    fetchTopics(search || undefined);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading">
            {t("TOPICS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("TOPICS_SUBTITLE")}</p>
        </div>
        {isAdmin && (
        <Button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {t("TOPIC_CREATE_BUTTON")}
        </Button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("TOPIC_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("TOPICS_EMPTY")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => router.push(`/dashboard/topics/${topic.id}`)}
              className="flex w-full items-center gap-3 rounded-lg border border-surface-border bg-surface p-4 text-left transition-colors hover:bg-surface-light"
            >
              <Layers className="h-5 w-5 shrink-0 text-secondary" />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-heading">{topic.name}</h3>
                {topic.description && (
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {topic.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTopicModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
