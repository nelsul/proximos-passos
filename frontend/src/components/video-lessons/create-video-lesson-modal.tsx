"use client";

import { useState, type FormEvent, useRef } from "react";
import { useTranslations } from "next-intl";
import { X, Upload, Plus, Link as LinkIcon } from "lucide-react";
import { createVideoLesson } from "@/lib/video-lessons";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { TopicPickerModal } from "@/components/handouts/topic-picker-modal";

interface CreateVideoLessonModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateVideoLessonModal({
  onClose,
  onCreated,
}: CreateVideoLessonModalProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoURL, setVideoURL] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<
    { id: string; name: string }[]
  >([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function removeTopic(id: string) {
    setSelectedTopics((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!file && !videoURL.trim()) {
      setError(t("VIDEO_LESSON_SOURCE_REQUIRED"));
      return;
    }

    const dur = parseInt(durationMinutes, 10);
    if (!dur || dur <= 0) {
      setError(t("VIDEO_LESSON_DURATION_REQUIRED"));
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      if (description) formData.append("description", description);
      if (videoURL.trim()) formData.append("video_url", videoURL.trim());
      formData.append("duration_minutes", String(dur));
      if (file) formData.append("file", file);
      selectedTopics.forEach((t) => formData.append("topic_ids", t.id));

      await createVideoLesson(formData);
      onCreated();
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
            {t("VIDEO_LESSON_CREATE_TITLE")}
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
            label={t("VIDEO_LESSON_TITLE_LABEL")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("VIDEO_LESSON_TITLE_PLACEHOLDER")}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("VIDEO_LESSON_DESCRIPTION_LABEL")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("VIDEO_LESSON_DESCRIPTION_PLACEHOLDER")}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>

          <InputField
            label={t("VIDEO_LESSON_DURATION_LABEL")}
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder={t("VIDEO_LESSON_DURATION_PLACEHOLDER")}
            required
          />

          {/* Video URL */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("VIDEO_LESSON_URL_LABEL")}
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="url"
                value={videoURL}
                onChange={(e) => setVideoURL(e.target.value)}
                placeholder={t("VIDEO_LESSON_URL_PLACEHOLDER")}
                className="w-full rounded-lg border border-surface-border bg-background py-2.5 pl-10 pr-4 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("VIDEO_LESSON_FILE_LABEL")}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-surface-border bg-background px-4 py-3 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
            >
              <Upload className="h-4 w-4" />
              {file ? file.name : t("VIDEO_LESSON_FILE_CHOOSE")}
            </button>
          </div>

          {/* Topic selection */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("VIDEO_LESSON_TOPICS_LABEL")}
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
              {t("VIDEO_LESSON_ADD_TOPIC")}
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
              {t("VIDEO_LESSON_CREATE_SUBMIT")}
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
