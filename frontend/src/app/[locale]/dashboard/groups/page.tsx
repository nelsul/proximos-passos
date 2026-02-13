"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Plus, Loader2 } from "lucide-react";
import { listGroups, type GroupResponse, type GroupFilter } from "@/lib/groups";
import { GroupCard } from "@/components/groups/group-card";
import { GroupFilters } from "@/components/groups/group-filters";
import { CreateGroupModal } from "@/components/groups/create-group-modal";
import { GroupDetailModal } from "@/components/groups/group-detail-modal";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 20;

export default function GroupsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupResponse | null>(
    null,
  );

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterName, setFilterName] = useState("");
  const [filterAccess, setFilterAccess] = useState("");

  const fetchGroups = useCallback(async (p: number, filter: GroupFilter) => {
    setLoading(true);
    try {
      const res = await listGroups(p, PAGE_SIZE, filter);
      setGroups(res.data);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced fetch on filter/page change
  useEffect(() => {
    const timer = setTimeout(() => {
      const filter: GroupFilter = {};
      if (filterName) filter.name = filterName;
      if (filterAccess) filter.access_type = filterAccess;
      fetchGroups(page, filter);
    }, 300);
    return () => clearTimeout(timer);
  }, [page, filterName, filterAccess, fetchGroups]);

  // Reset to page 1 when filters change
  function handleFilterName(v: string) {
    setFilterName(v);
    setPage(1);
  }
  function handleFilterAccess(v: string) {
    setFilterAccess(v);
    setPage(1);
  }

  function handleGroupCreated() {
    setShowCreate(false);
    toast(t("GROUP_CREATE_SUCCESS"));
    router.push("/dashboard/my-groups");
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            {t("GROUPS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("GROUPS_SUBTITLE")}</p>
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
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-12 text-center">
          <p className="text-muted">{t("GROUPS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() => setSelectedGroup(group)}
              />
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

      {selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
}
