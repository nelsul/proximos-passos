import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { updateActivityItem, type ActivityItemResponse } from "@/lib/activities";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";

interface EditItemModalProps {
  item: ActivityItemResponse;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditItemModal({ item, onClose, onUpdated }: EditItemModalProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await updateActivityItem(item.id, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onUpdated();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          t(`ERROR_\${err.code}` as Parameters<typeof t>[0], {
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
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("ACTIVITY_ITEM_EDIT_TITLE")}
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
            label={t("ACTIVITY_ITEM_TITLE_LABEL")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("ACTIVITY_ITEM_TITLE_PLACEHOLDER")}
            required
            autoFocus
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">
              {t("ACTIVITY_ITEM_DESCRIPTION_LABEL")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ACTIVITY_ITEM_DESCRIPTION_PLACEHOLDER")}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
            <p className="mt-1 text-xs text-muted">
              {t("QUESTION_LATEX_HINT")}
            </p>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="mt-4 flex gap-3 pt-4 border-t border-surface-border">
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
