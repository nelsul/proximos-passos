"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  Loader2,
  CalendarClock,
  History,
  Search,
  Plus,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  listUpcomingActivities,
  listPastActivities,
  type ActivityResponse,
} from "@/lib/activities";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { CreateActivityModal } from "@/components/activities/create-activity-modal";

const PAGE_SIZE = 10;

interface ActivityListProps {
  groupId: string;
  isGroupAdmin: boolean;
}

export function ActivityList({ groupId, isGroupAdmin }: ActivityListProps) {
  const t = useTranslations();
  const router = useRouter();

  // Upcoming
  const [upcoming, setUpcoming] = useState<ActivityResponse[]>([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingSearch, setUpcomingSearch] = useState("");

  // Past
  const [past, setPast] = useState<ActivityResponse[]>([]);
  const [pastPage, setPastPage] = useState(1);
  const [pastTotalPages, setPastTotalPages] = useState(1);
  const [pastLoading, setPastLoading] = useState(true);
  const [pastSearch, setPastSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const upcomingDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pastDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchUpcoming = useCallback(
    async (page: number, search: string) => {
      setUpcomingLoading(true);
      try {
        const res = await listUpcomingActivities(groupId, page, PAGE_SIZE, {
          title: search || undefined,
        });
        setUpcoming(res.data);
        setUpcomingTotalPages(res.total_pages);
      } finally {
        setUpcomingLoading(false);
      }
    },
    [groupId],
  );

  const fetchPast = useCallback(
    async (page: number, search: string) => {
      setPastLoading(true);
      try {
        const res = await listPastActivities(groupId, page, PAGE_SIZE, {
          title: search || undefined,
        });
        setPast(res.data);
        setPastTotalPages(res.total_pages);
      } finally {
        setPastLoading(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    fetchUpcoming(upcomingPage, upcomingSearch);
  }, [upcomingPage, fetchUpcoming]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPast(pastPage, pastSearch);
  }, [pastPage, fetchPast]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleUpcomingSearch(value: string) {
    setUpcomingSearch(value);
    clearTimeout(upcomingDebounce.current);
    upcomingDebounce.current = setTimeout(() => {
      setUpcomingPage(1);
      fetchUpcoming(1, value);
    }, 300);
  }

  function handlePastSearch(value: string) {
    setPastSearch(value);
    clearTimeout(pastDebounce.current);
    pastDebounce.current = setTimeout(() => {
      setPastPage(1);
      fetchPast(1, value);
    }, 300);
  }

  function formatDueDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
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

  function handleActivityClick(activityId: string) {
    router.push(`/dashboard/activities/${activityId}?group=${groupId}`);
  }

  return (
    <div className="space-y-8">
      {/* Upcoming Activities */}
      <div className="rounded-lg border border-surface-border bg-surface p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
            <CalendarClock className="h-5 w-5 text-secondary" />
            {t("ACTIVITY_UPCOMING_TITLE")}
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={upcomingSearch}
                onChange={(e) => handleUpcomingSearch(e.target.value)}
                placeholder={t("ACTIVITY_SEARCH_PLACEHOLDER")}
                className="w-full rounded-lg border border-surface-border bg-background py-2 pl-9 pr-3 text-sm text-body placeholder-muted outline-none focus:border-secondary sm:w-56"
              />
            </div>
            {isGroupAdmin && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                {t("ACTIVITY_CREATE_BUTTON")}
              </Button>
            )}
          </div>
        </div>

        {upcomingLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {t("ACTIVITY_EMPTY_UPCOMING")}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {upcoming.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleActivityClick(a.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-background p-4 text-left transition-colors hover:border-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-heading truncate">
                      {a.title}
                    </h3>
                    {a.description && (
                      <p className="mt-0.5 text-xs text-muted line-clamp-1">
                        {a.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-1.5">
                    {isDueSoon(a.due_date) ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted" />
                    )}
                    <span
                      className={`text-xs ${isDueSoon(a.due_date) ? "text-warning font-medium" : "text-muted"}`}
                    >
                      {formatDueDate(a.due_date)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <Pagination
              page={upcomingPage}
              totalPages={upcomingTotalPages}
              onPageChange={setUpcomingPage}
            />
          </>
        )}
      </div>

      {/* Past Activities */}
      <div className="rounded-lg border border-surface-border bg-surface p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
            <History className="h-5 w-5 text-muted" />
            {t("ACTIVITY_PAST_TITLE")}
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={pastSearch}
              onChange={(e) => handlePastSearch(e.target.value)}
              placeholder={t("ACTIVITY_SEARCH_PLACEHOLDER")}
              className="w-full rounded-lg border border-surface-border bg-background py-2 pl-9 pr-3 text-sm text-body placeholder-muted outline-none focus:border-secondary sm:w-56"
            />
          </div>
        </div>

        {pastLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
          </div>
        ) : past.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {t("ACTIVITY_EMPTY_PAST")}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {past.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleActivityClick(a.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-background p-4 text-left opacity-75 transition-colors hover:opacity-100 hover:border-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-heading truncate">
                      {a.title}
                    </h3>
                    {a.description && (
                      <p className="mt-0.5 text-xs text-muted line-clamp-1">
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
              page={pastPage}
              totalPages={pastTotalPages}
              onPageChange={setPastPage}
            />
          </>
        )}
      </div>

      {/* Create Activity Modal */}
      {showCreate && (
        <CreateActivityModal
          groupId={groupId}
          onCreated={() => {
            setShowCreate(false);
            fetchUpcoming(1, upcomingSearch);
            setUpcomingPage(1);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
