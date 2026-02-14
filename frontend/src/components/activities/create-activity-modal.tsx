"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { createActivity, type ActivityResponse } from "@/lib/activities";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { useToast } from "@/components/ui/toast";

interface CreateActivityModalProps {
  groupId: string;
  onCreated: (activity: ActivityResponse) => void;
  onClose: () => void;
}

export function CreateActivityModal({
  groupId,
  onCreated,
  onClose,
}: CreateActivityModalProps) {
  const t = useTranslations();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setLoading(true);
    setError("");
    try {
      const activity = await createActivity(groupId, {
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: new Date(dueDate).toISOString(),
      });
      toast(t("ACTIVITY_CREATE_SUCCESS"));
      onCreated(activity);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(t(`ERROR_${err.code}`));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-background p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-heading">
            {t("ACTIVITY_CREATE_TITLE")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-heading">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label={t("ACTIVITY_TITLE_LABEL")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("ACTIVITY_TITLE_PLACEHOLDER")}
            required
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-body">
              {t("ACTIVITY_DESCRIPTION_LABEL")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ACTIVITY_DESCRIPTION_PLACEHOLDER")}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body placeholder-muted outline-none focus:border-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-body">
              {t("ACTIVITY_DUE_DATE_LABEL")}
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm text-body outline-none focus:border-secondary [color-scheme:dark]"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              type="button"
              className="flex-1"
            >
              {t("PROFILE_CANCEL")}
            </Button>
            <Button
              size="sm"
              type="submit"
              loading={loading}
              className="flex-1"
            >
              {t("ACTIVITY_CREATE_SUBMIT")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
