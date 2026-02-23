"use client";

import { useState, useRef, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Upload, FileText, Link as LinkIcon } from "lucide-react";
import {
  updateExerciseList,
  replaceExerciseListFile,
  type ExerciseListResponse,
} from "@/lib/open-exercise-lists";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { TopicPickerModal } from "@/components/handouts/topic-picker-modal";

interface EditExerciseListModalProps {
  exerciseList: ExerciseListResponse;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditExerciseListModal({
  exerciseList,
  onClose,
  onUpdated,
}: EditExerciseListModalProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(exerciseList.title);
  const [description, setDescription] = useState(
    exerciseList.description ?? "",
  );
  const [fileURL, setFileURL] = useState(exerciseList.file_url ?? "");
  const [selectedTopics, setSelectedTopics] = useState<
    { id: string; name: string }[]
  >(exerciseList.topics.map((t) => ({ id: t.id, name: t.name })));
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function removeTopic(id: string) {
    setSelectedTopics((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await updateExerciseList(exerciseList.id, {
        title,
        description: description || undefined,
        file_url: fileURL.trim() || undefined,
        topic_ids: selectedTopics.map((t) => t.id),
      });

      if (newFile) {
        await replaceExerciseListFile(exerciseList.id, newFile);
      }

      onUpdated();
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("EXERCISE_LIST_EDIT_TITLE")}
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
            label={t("EXERCISE_LIST_TITLE_LABEL")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("EXERCISE_LIST_TITLE_PLACEHOLDER")}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("EXERCISE_LIST_DESCRIPTION_LABEL")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("EXERCISE_LIST_DESCRIPTION_PLACEHOLDER")}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>

          {/* File URL */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("EXERCISE_LIST_URL_LABEL")}
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="url"
                value={fileURL}
                onChange={(e) => setFileURL(e.target.value)}
                placeholder={t("EXERCISE_LIST_URL_PLACEHOLDER")}
                className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>
          </div>

          {/* File replacement */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("EXERCISE_LIST_FILE_LABEL")}
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-background px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-sm text-body">
                {newFile
                  ? newFile.name
                  : (exerciseList.file?.filename ?? t("EXERCISE_LIST_NO_FILE"))}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-secondary hover:text-heading"
              >
                <Upload className="h-3.5 w-3.5" />
                {t("EXERCISE_LIST_REPLACE_FILE")}
              </button>
            </div>
            {newFile && (
              <p className="text-xs text-muted">
                {t("EXERCISE_LIST_NEW_FILE_SELECTED")}
              </p>
            )}
          </div>

          {/* Topic selection */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("EXERCISE_LIST_TOPICS_LABEL")}
            </label>
            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTopics.map((topic) => (
                  <span
                    key={topic.id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary"
                  >
                    {topic.name}
                    <button
                      type="button"
                      onClick={() => removeTopic(topic.id)}
                      className="rounded-full p-0.5 transition-colors hover:bg-secondary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowTopicPicker(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3 py-2 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
            >
              <Plus className="h-4 w-4" />
              {t("EXERCISE_LIST_ADD_TOPIC")}
            </button>
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
              {t("PROFILE_SAVE")}
            </Button>
          </div>
        </form>
      </div>

      {showTopicPicker && (
        <TopicPickerModal
          selected={selectedTopics}
          onConfirm={(topics) => {
            setSelectedTopics(topics);
            setShowTopicPicker(false);
          }}
          onClose={() => setShowTopicPicker(false)}
        />
      )}
    </div>
  );
}
