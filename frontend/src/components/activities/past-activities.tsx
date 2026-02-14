"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Loader2, Search, Clock } from "lucide-react";
import { listPastActivities, type ActivityResponse } from "@/lib/activities";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 10;

interface PastActivitiesProps {
  groupId: string;
}

export function PastActivities({ groupId }: PastActivitiesProps) {
  const t = useTranslations();
  const router = useRouter();

  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchActivities = useCallback(
    async (p: number, s: string) => {
      setLoading(true);
      try {
        const res = await listPastActivities(groupId, p, PAGE_SIZE, {
          title: s || undefined,
        });
        setActivities(res.data);
        setTotalPages(res.total_pages);
      } finally {
        setLoading(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    fetchActivities(page, search);
  }, [page, fetchActivities]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchActivities(1, value);
    }, 300);
  }

  function formatDueDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <>
      <div className="mb-4">
        <div className="relative sm:w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("ACTIVITY_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2 pl-9 pr-3 text-sm text-body placeholder-muted outline-none focus:border-secondary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-secondary" />
        </div>
      ) : activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t("ACTIVITY_EMPTY_PAST")}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {activities.map((a) => (
              <button
                key={a.id}
                onClick={() =>
                  router.push(`/dashboard/activities/${a.id}?group=${groupId}`)
                }
                className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-background p-4 text-left opacity-75 transition-colors hover:border-secondary/40 hover:opacity-100"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-heading">
                    {a.title}
                  </h3>
                  {a.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {a.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted" />
                  <span className="text-xs text-muted">
                    {formatDueDate(a.due_date)}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
