"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { createExam, type ExamResponse } from "@/lib/exams";
import { listInstitutions, type InstitutionResponse } from "@/lib/institutions";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface CreateExamModalProps {
  onClose: () => void;
  onCreated: (exam: ExamResponse) => void;
}

export function CreateExamModal({ onClose, onCreated }: CreateExamModalProps) {
  const t = useTranslations();
  const [institutionId, setInstitutionId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);

  useEffect(() => {
    listInstitutions(1, 50).then((res) => {
      setInstitutions(res.data ?? []);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const exam = await createExam({
        institution_id: institutionId,
        title,
        description: description || undefined,
        year: parseInt(year, 10),
      });
      onCreated(exam);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
            defaultValue: err.message,
          }),
        );
      } else {
        setError(t("ERROR_INTERNAL_ERROR"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("EXAM_CREATE_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("EXAM_INSTITUTION_LABEL")}
            </label>
            <SearchableSelect
              value={institutionId}
              onChange={setInstitutionId}
              options={institutions.map((inst) => ({
                value: inst.id,
                label: `${inst.name} (${inst.acronym})`,
              }))}
              onSearch={async (q) => {
                const res = await listInstitutions(1, 50, q ? { name: q } : undefined);
                return (res.data ?? []).map((inst) => ({
                  value: inst.id,
                  label: `${inst.name} (${inst.acronym})`,
                }));
              }}
              placeholder={t("EXAM_INSTITUTION_PLACEHOLDER")}
              searchPlaceholder={t("SEARCHABLE_SELECT_SEARCH_PLACEHOLDER")}
              emptyMessage={t("SEARCHABLE_SELECT_EMPTY")}
              className="w-full"
            />
          </div>

          <InputField
            label={t("EXAM_TITLE_LABEL")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("EXAM_TITLE_PLACEHOLDER")}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("EXAM_DESCRIPTION_LABEL")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("EXAM_DESCRIPTION_PLACEHOLDER")}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>

          <InputField
            label={t("EXAM_YEAR_LABEL")}
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder={t("EXAM_YEAR_PLACEHOLDER")}
            required
            min={1900}
            max={2100}
          />

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("PROFILE_CANCEL")}
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {t("EXAM_CREATE_SUBMIT")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
