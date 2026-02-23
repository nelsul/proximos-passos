"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Loader2, Search, Plus, Clock, AlertTriangle } from "lucide-react";
import {
  listUpcomingActivities,
  type ActivityResponse,
} from "@/lib/activities";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { CreateActivityModal } from "@/components/activities/create-activity-modal";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { PlayCircle, HelpCircle, CheckSquare } from "lucide-react";

const PAGE_SIZE = 10;

interface UpcomingActivitiesProps {
  groupId: string;
  isGroupAdmin: boolean;
}

export function UpcomingActivities({
  groupId,
  isGroupAdmin,
}: UpcomingActivitiesProps) {
  const t = useTranslations();
  const router = useRouter();

  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchActivities = useCallback(
    async (p: number, s: string) => {
      setLoading(true);
      try {
        const res = await listUpcomingActivities(groupId, p, PAGE_SIZE, {
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

  function isDueSoon(dateStr: string): boolean {
    const diff = new Date(dateStr).getTime() - Date.now();
    return diff > 0 && diff < 48 * 60 * 60 * 1000;
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("ACTIVITY_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-surface/50 py-2.5 pl-9 pr-3 text-sm text-heading placeholder-muted outline-none focus:border-secondary transition-colors hover:border-secondary/50 sm:w-56"
          />
        </div>
        {isGroupAdmin && (
          <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {t("ACTIVITY_CREATE_BUTTON")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-secondary" />
        </div>
      ) : activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t("ACTIVITY_EMPTY_UPCOMING")}
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
                className="group flex flex-col sm:flex-row w-full sm:items-center justify-between gap-3 sm:gap-4 rounded-xl border border-surface-border bg-surface p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:bg-surface-light hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-heading transition-colors group-hover:text-secondary-light line-clamp-2">
                    {a.title}
                  </h3>
                  {a.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {a.description}
                    </p>
                  )}
                  {/* Stats Badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {a.total_video_duration_minutes > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>
                          {t("ACTIVITY_SUMMARY_VIDEO", {
                            minutes: a.total_video_duration_minutes,
                          })}
                        </span>
                      </div>
                    )}
                    {a.total_questions_count > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>
                          {t("ACTIVITY_SUMMARY_QUESTIONS", {
                            count: a.total_questions_count,
                          })}
                        </span>
                      </div>
                    )}
                    {a.total_exercise_lists_count > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>
                          {t("ACTIVITY_SUMMARY_EXERCISES", {
                            count: a.total_exercise_lists_count,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto border-t border-surface-border/50 sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5">
                    {isDueSoon(a.due_date) ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted" />
                    )}
                    <span
                      className={`text-xs ${isDueSoon(a.due_date) ? "font-medium text-warning" : "text-muted"}`}
                    >
                      <CountdownTimer targetDate={a.due_date} />
                    </span>
                  </div>
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

      {showCreate && (
        <CreateActivityModal
          groupId={groupId}
          onCreated={() => {
            setShowCreate(false);
            fetchActivities(1, search);
            setPage(1);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
