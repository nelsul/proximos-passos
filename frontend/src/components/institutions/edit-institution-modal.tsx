"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  updateInstitution,
  type InstitutionResponse,
} from "@/lib/institutions";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";

interface EditInstitutionModalProps {
  institution: InstitutionResponse;
  onClose: () => void;
  onUpdated: (institution: InstitutionResponse) => void;
}

export function EditInstitutionModal({
  institution,
  onClose,
  onUpdated,
}: EditInstitutionModalProps) {
  const t = useTranslations();
  const [name, setName] = useState(institution.name);
  const [acronym, setAcronym] = useState(institution.acronym);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const updated = await updateInstitution(institution.id, {
        name,
        acronym,
      });
      onUpdated(updated);
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
            {t("INSTITUTION_EDIT_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <InputField
            label={t("INSTITUTION_NAME_LABEL")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("INSTITUTION_NAME_PLACEHOLDER")}
            required
            autoFocus
          />

          <InputField
            label={t("INSTITUTION_ACRONYM_LABEL")}
            value={acronym}
            onChange={(e) => setAcronym(e.target.value)}
            placeholder={t("INSTITUTION_ACRONYM_PLACEHOLDER")}
            required
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
              {t("PROFILE_SAVE")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
