"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";
import {
  listMyGroups,
  type GroupResponse,
  type GroupFilter,
} from "@/lib/groups";
import { GroupCard } from "@/components/groups/group-card";
import { GroupFilters } from "@/components/groups/group-filters";
import { CreateGroupModal } from "@/components/groups/create-group-modal";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 20;

export default function MyGroupsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterName, setFilterName] = useState("");
  const [filterAccess, setFilterAccess] = useState("");
  const [filterVisibility, setFilterVisibility] = useState("");

  const fetchGroups = useCallback(async (p: number, filter: GroupFilter) => {
    setLoading(true);
    try {
      const res = await listMyGroups(p, PAGE_SIZE, filter);
      setGroups(res.data);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const filter: GroupFilter = {};
      if (filterName) filter.name = filterName;
      if (filterAccess) filter.access_type = filterAccess;
      if (filterVisibility) filter.visibility_type = filterVisibility;
      fetchGroups(page, filter);
    }, 300);
    return () => clearTimeout(timer);
  }, [page, filterName, filterAccess, filterVisibility, fetchGroups]);

  function handleFilterName(v: string) {
    setFilterName(v);
    setPage(1);
  }
  function handleFilterAccess(v: string) {
    setFilterAccess(v);
    setPage(1);
  }
  function handleFilterVisibility(v: string) {
    setFilterVisibility(v);
    setPage(1);
  }

  function handleGroupCreated(_group: GroupResponse) {
    setShowCreate(false);
    toast(t("GROUP_CREATE_SUCCESS"));
    // Refresh list from server to get accurate pagination
    const filter: GroupFilter = {};
    if (filterName) filter.name = filterName;
    if (filterAccess) filter.access_type = filterAccess;
    if (filterVisibility) filter.visibility_type = filterVisibility;
    fetchGroups(1, filter);
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            {t("MY_GROUPS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("MY_GROUPS_SUBTITLE")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="w-auto"
        >
          <Plus className="h-4 w-4" />
          {t("GROUP_CREATE_BUTTON")}
        </Button>
      </div>

      <GroupFilters
        name={filterName}
        onNameChange={handleFilterName}
        accessType={filterAccess}
        onAccessTypeChange={handleFilterAccess}
        showVisibility
        visibilityType={filterVisibility}
        onVisibilityTypeChange={handleFilterVisibility}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-12 text-center">
          <p className="text-muted">{t("MY_GROUPS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
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
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
