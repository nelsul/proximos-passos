"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Plus, Loader2, Search, Building2, Pencil, Trash2 } from "lucide-react";
import {
  listInstitutions,
  deleteInstitution,
  type InstitutionResponse,
} from "@/lib/institutions";
import { CreateInstitutionModal } from "@/components/institutions/create-institution-modal";
import { EditInstitutionModal } from "@/components/institutions/edit-institution-modal";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { useIsAdmin } from "@/contexts/user-context";

export default function InstitutionsPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingInstitution, setEditingInstitution] =
    useState<InstitutionResponse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInstitutions = useCallback(async (name?: string, pageNum = 1) => {
    setLoading(true);
    try {
      const filter = name ? { name } : undefined;
      const res = await listInstitutions(pageNum, 10, filter);
      setInstitutions(res.data ?? []);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchInstitutions(search || undefined, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchInstitutions]);

  useEffect(() => {
    fetchInstitutions(search || undefined, page);
  }, [page, fetchInstitutions, search]);

  function handleCreated() {
    setShowCreate(false);
    toast(t("INSTITUTION_CREATE_SUCCESS"));
    fetchInstitutions(search || undefined, page);
  }

  function handleUpdated() {
    setEditingInstitution(null);
    toast(t("INSTITUTION_UPDATE_SUCCESS"));
    fetchInstitutions(search || undefined, page);
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteInstitution(id);
      toast(t("INSTITUTION_DELETE_SUCCESS"));
      fetchInstitutions(search || undefined, page);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading">
            {t("INSTITUTIONS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("INSTITUTIONS_SUBTITLE")}
          </p>
        </div>
        {isAdmin && (
          <Button className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("INSTITUTION_CREATE_BUTTON")}
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
            placeholder={t("INSTITUTION_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : institutions.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("INSTITUTIONS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {institutions.map((institution) => (
              <div
                key={institution.id}
                onClick={() =>
                  router.push(
                    `/${locale}/dashboard/institutions/${institution.id}`,
                  )
                }
                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-surface-border bg-surface p-3 sm:p-4 transition-colors hover:border-secondary hover:bg-surface-light sm:flex-row sm:items-center sm:gap-3"
              >
                <Building2 className="h-5 w-5 shrink-0 text-secondary" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-heading">
                    {institution.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">
                    {institution.acronym}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingInstitution(institution);
                      }}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-light hover:text-heading"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(institution.id);
                      }}
                      disabled={deletingId === institution.id}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
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
        <CreateInstitutionModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {editingInstitution && (
        <EditInstitutionModal
          institution={editingInstitution}
          onClose={() => setEditingInstitution(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
