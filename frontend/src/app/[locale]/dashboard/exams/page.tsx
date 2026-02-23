"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Plus,
  Loader2,
  Search,
  GraduationCap,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { listExams, deleteExam, type ExamResponse } from "@/lib/exams";
import { listInstitutions, type InstitutionResponse } from "@/lib/institutions";
import { CreateExamModal } from "@/components/exams/create-exam-modal";
import { EditExamModal } from "@/components/exams/edit-exam-modal";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useIsAdmin } from "@/contexts/user-context";

export default function ExamsPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamResponse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    listInstitutions(1, 100).then((res) => {
      setInstitutions(res.data ?? []);
    });
  }, []);

  const fetchExams = useCallback(
    async (institutionId?: string, pageNum = 1) => {
      setLoading(true);
      try {
        const filter: { institution_id?: string } = {};
        if (institutionId) filter.institution_id = institutionId;
        const res = await listExams(
          pageNum,
          10,
          Object.keys(filter).length > 0 ? filter : undefined,
        );
        setExams(res.data ?? []);
        setTotalPages(res.total_pages);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setPage(1);
    fetchExams(institutionFilter?.id, 1);
  }, [institutionFilter, fetchExams]);

  useEffect(() => {
    fetchExams(institutionFilter?.id, page);
  }, [page, fetchExams, institutionFilter]);

  function handleCreated() {
    setShowCreate(false);
    toast(t("EXAM_CREATE_SUCCESS"));
    fetchExams(institutionFilter?.id, page);
  }

  function handleUpdated() {
    setEditingExam(null);
    toast(t("EXAM_UPDATE_SUCCESS"));
    fetchExams(institutionFilter?.id, page);
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteExam(id);
      toast(t("EXAM_DELETE_SUCCESS"));
      fetchExams(institutionFilter?.id, page);
    } finally {
      setDeletingId(null);
    }
  }

  function formatExamLabel(exam: ExamResponse): string {
    return `${exam.institution.acronym} ${exam.year} — ${exam.title}`;
  }

  const filteredExams = search
    ? exams.filter((exam) => {
        const q = search.toLowerCase();
        return (
          exam.institution.name.toLowerCase().includes(q) ||
          exam.institution.acronym.toLowerCase().includes(q) ||
          exam.title.toLowerCase().includes(q) ||
          exam.year.toString().includes(q)
        );
      })
    : exams;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading">
            {t("EXAMS_TITLE")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("EXAMS_SUBTITLE")}</p>
        </div>
        {isAdmin && (
          <Button className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("EXAM_CREATE_BUTTON")}
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("EXAM_SEARCH_PLACEHOLDER")}
            className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
          />
        </div>
        {institutionFilter ? (
          <button
            onClick={() => setInstitutionFilter(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary/20"
          >
            {institutionFilter.name}
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <select
            onChange={(e) => {
              const inst = institutions.find((i) => i.id === e.target.value);
              if (inst)
                setInstitutionFilter({ id: inst.id, name: inst.acronym });
            }}
            value=""
            className="w-full sm:w-auto rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
          >
            <option value="">{t("EXAM_FILTER_BY_INSTITUTION")}</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.acronym})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface p-8 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-muted">{t("EXAMS_EMPTY")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                onClick={() =>
                  router.push(`/${locale}/dashboard/exams/${exam.id}`)
                }
                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-surface-border bg-surface p-3 sm:p-4 transition-colors hover:border-secondary hover:bg-surface-light sm:flex-row sm:items-center sm:gap-3"
              >
                <GraduationCap className="h-5 w-5 shrink-0 text-secondary" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-heading">
                    {formatExamLabel(exam)}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">
                    {exam.institution.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingExam(exam);
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
                        handleDelete(exam.id);
                      }}
                      disabled={deletingId === exam.id}
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
        <CreateExamModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {editingExam && (
        <EditExamModal
          exam={editingExam}
          onClose={() => setEditingExam(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
