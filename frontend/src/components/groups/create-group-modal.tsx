"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { createGroup, type GroupResponse } from "@/lib/groups";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (group: GroupResponse) => void;
}

export function CreateGroupModal({
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessType, setAccessType] = useState<"open" | "closed">("closed");
  const [visibilityType, setVisibilityType] = useState<"public" | "private">(
    "public",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const group = await createGroup({
        name,
        description: description || undefined,
        access_type: accessType,
        visibility_type: visibilityType,
      });
      onCreated(group);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("GROUP_CREATE_TITLE")}
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
            label={t("GROUP_NAME_LABEL")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("GROUP_NAME_PLACEHOLDER")}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("GROUP_DESCRIPTION_LABEL")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("GROUP_DESCRIPTION_PLACEHOLDER")}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-heading">
                {t("GROUP_VISIBILITY_LABEL")}
              </label>
              <select
                value={visibilityType}
                onChange={(e) =>
                  setVisibilityType(e.target.value as "public" | "private")
                }
                className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="public">{t("GROUP_VISIBILITY_PUBLIC")}</option>
                <option value="private">{t("GROUP_VISIBILITY_PRIVATE")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-heading">
                {t("GROUP_ACCESS_LABEL")}
              </label>
              <select
                value={accessType}
                onChange={(e) =>
                  setAccessType(e.target.value as "open" | "closed")
                }
                className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="open">{t("GROUP_ACCESS_OPEN")}</option>
                <option value="closed">{t("GROUP_ACCESS_CLOSED")}</option>
              </select>
            </div>
          </div>

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
              {t("GROUP_CREATE_SUBMIT")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
