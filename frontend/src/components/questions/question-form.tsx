"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Plus,
  ImagePlus,
  Trash2,
  Eye,
  EyeOff,
  X,
  ChevronUp,
  ChevronDown,
  Type,
  Monitor,
} from "lucide-react";
import {
  createQuestion,
  updateQuestion,
  addQuestionImages,
  removeQuestionImage,
  getQuestion,
  type QuestionResponse,
  type QuestionImageResponse,
} from "@/lib/questions";
import { listExams, type ExamResponse } from "@/lib/exams";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TopicPickerModal } from "@/components/handouts/topic-picker-modal";
import { LatexText } from "@/components/ui/latex-text";
import { LatexToolbar } from "@/components/ui/latex-toolbar";
import { StatementRenderer } from "@/components/questions/statement-renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentBlock {
  id: string;
  type: "text" | "image";
  content: string; // for text blocks
  file?: File; // for new image blocks
  existingImage?: { id: string; url: string; filename: string };
}

interface OptionImageDraft {
  id: string; // React key
  file?: File;
  existingId?: string;
  existingUrl?: string;
  existingFilename?: string;
}

interface OptionDraft {
  text: string;
  isCorrect: boolean;
  images: OptionImageDraft[];
}

interface QuestionFormProps {
  mode: "create" | "edit";
  initialQuestion?: QuestionResponse;
  onSaved: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return crypto.randomUUID();
}

function parseStatementToBlocks(
  statement: string,
  images: QuestionImageResponse[],
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const regex = /\{\{img:(\d+)\}\}/g;
  let lastIndex = 0;
  let match;
  const referencedIndices = new Set<number>();

  while ((match = regex.exec(statement)) !== null) {
    const textBefore = statement.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      blocks.push({ id: uid(), type: "text", content: textBefore.trim() });
    }

    const imgIndex = parseInt(match[1], 10);
    referencedIndices.add(imgIndex);
    const image = images[imgIndex];
    if (image) {
      blocks.push({
        id: uid(),
        type: "image",
        content: "",
        existingImage: {
          id: image.id,
          url: image.url,
          filename: image.filename,
        },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = statement.slice(lastIndex).trim();
  if (remaining) {
    blocks.push({ id: uid(), type: "text", content: remaining });
  }

  // Append unreferenced images (legacy questions without markers)
  for (let i = 0; i < images.length; i++) {
    if (!referencedIndices.has(i)) {
      blocks.push({
        id: uid(),
        type: "image",
        content: "",
        existingImage: {
          id: images[i].id,
          url: images[i].url,
          filename: images[i].filename,
        },
      });
    }
  }

  // Ensure at least one text block
  if (blocks.length === 0 || blocks.every((b) => b.type === "image")) {
    blocks.unshift({
      id: uid(),
      type: "text",
      content: blocks.length === 0 ? "" : statement,
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestionForm({
  mode,
  initialQuestion,
  onSaved,
  onCancel,
}: QuestionFormProps) {
  const t = useTranslations();
  const optionImageRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const blockImageRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const blockTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const optionTextareaRefs = useRef<Map<number, HTMLTextAreaElement>>(
    new Map(),
  );
  const expectedAnswerRef = useRef<HTMLTextAreaElement>(null);

  // ---- State ----
  const [qType, setQType] = useState(initialQuestion?.type ?? "closed_ended");
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => {
    if (initialQuestion) {
      return parseStatementToBlocks(
        initialQuestion.statement,
        initialQuestion.images,
      );
    }
    return [{ id: uid(), type: "text", content: "" }];
  });
  const [expectedAnswer, setExpectedAnswer] = useState(
    initialQuestion?.expected_answer_text ?? "",
  );
  const [passingScore, setPassingScore] = useState(
    initialQuestion?.passing_score != null
      ? String(initialQuestion.passing_score)
      : "",
  );
  const [options, setOptions] = useState<OptionDraft[]>(() => {
    if (
      initialQuestion?.type === "closed_ended" &&
      initialQuestion.options.length > 0
    ) {
      return initialQuestion.options.map((o) => ({
        text: o.text ?? "",
        isCorrect: o.is_correct,
        images: (o.images ?? []).map((img) => ({
          id: uid(),
          existingId: img.id,
          existingUrl: img.url,
          existingFilename: img.filename,
        })),
      }));
    }
    return [
      { text: "", isCorrect: false, images: [] },
      { text: "", isCorrect: false, images: [] },
    ];
  });
  const [selectedTopics, setSelectedTopics] = useState<
    { id: string; name: string }[]
  >(initialQuestion?.topics.map((tp) => ({ id: tp.id, name: tp.name })) ?? []);
  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialQuestion?.exam?.id ?? "",
  );
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load exams for the picker
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listExams(1, 200);
        if (!cancelled) setExams(res.data ?? []);
      } finally {
        if (!cancelled) setExamsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Block operations ----

  function addBlock(type: "text" | "image", afterIndex: number) {
    setBlocks((prev) => {
      const block: ContentBlock = { id: uid(), type, content: "" };
      const copy = [...prev];
      copy.splice(afterIndex + 1, 0, block);
      return copy;
    });
  }

  function addImageBlock(afterIndex: number, file: File) {
    setBlocks((prev) => {
      const block: ContentBlock = {
        id: uid(),
        type: "image",
        content: "",
        file,
      };
      const copy = [...prev];
      copy.splice(afterIndex + 1, 0, block);
      return copy;
    });
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBlockContent(index: number, content: string) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, content } : b)),
    );
  }

  function moveBlock(index: number, direction: "up" | "down") {
    setBlocks((prev) => {
      const copy = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return prev;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  // ---- Option operations ----

  function updateOption(
    idx: number,
    field: keyof OptionDraft,
    value: string | boolean | OptionImageDraft[],
  ) {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)),
    );
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: "", isCorrect: false, images: [] }]);
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- Serialization ----

  function buildStatementText(): string {
    let imageIndex = 0;
    let statement = "";

    for (const block of blocks) {
      if (block.type === "text") {
        if (statement && !statement.endsWith("\n")) statement += "\n";
        statement += block.content;
      } else {
        // Placeholder; actual index assigned in submit handlers
        statement += `\n{{img:__PLACEHOLDER_${block.id}__}}\n`;
      }
    }

    return statement.trim();
  }

  // ---- Submit: CREATE ----

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Validate
    const hasTextBlock = blocks.some(
      (b) => b.type === "text" && b.content.trim(),
    );
    if (!hasTextBlock) {
      setError(t("QUESTION_STATEMENT_REQUIRED"));
      return;
    }

    if (qType === "open_ended") {
      if (!expectedAnswer.trim()) {
        setError(t("QUESTION_EXPECTED_ANSWER_REQUIRED"));
        return;
      }
      if (!passingScore.trim()) {
        setError(t("QUESTION_PASSING_SCORE_REQUIRED"));
        return;
      }
    }

    if (qType === "closed_ended") {
      const filledOptions = options.filter(
        (o) => o.text.trim() || o.images.length > 0,
      );
      if (filledOptions.length < 2) {
        setError(t("QUESTION_OPTIONS_MIN_TWO"));
        return;
      }
      if (!filledOptions.some((o) => o.isCorrect)) {
        setError(t("QUESTION_OPTIONS_NEED_CORRECT"));
        return;
      }
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("type", qType);

      // Build statement with image markers; collect image files in order
      const imageFiles: File[] = [];
      let statement = "";

      for (const block of blocks) {
        if (block.type === "text") {
          if (statement && !statement.endsWith("\n")) statement += "\n";
          statement += block.content;
        } else if (block.type === "image" && block.file) {
          statement += `\n{{img:${imageFiles.length}}}\n`;
          imageFiles.push(block.file);
        }
      }

      formData.append("statement", statement.trim());

      if (qType === "open_ended") {
        if (expectedAnswer.trim())
          formData.append("expected_answer_text", expectedAnswer.trim());
        if (passingScore.trim())
          formData.append("passing_score", passingScore.trim());
      }

      if (qType === "closed_ended") {
        const validOptions = options.filter(
          (o) => o.text.trim() || o.images.length > 0,
        );
        const optionData = validOptions.map((o) => ({
          text: o.text.trim() || undefined,
          is_correct: o.isCorrect,
        }));
        formData.append("options", JSON.stringify(optionData));
        validOptions.forEach((o, idx) => {
          o.images.forEach((img) => {
            if (img.file) {
              formData.append(`option_images[${idx}]`, img.file);
            }
          });
        });
      }

      selectedTopics.forEach((tp) => formData.append("topic_ids", tp.id));
      if (selectedExamId) formData.append("exam_id", selectedExamId);
      imageFiles.forEach((f) => formData.append("images", f));

      await createQuestion(formData);
      onSaved();
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

  // ---- Submit: EDIT ----

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!initialQuestion) return;
    setError("");

    const hasTextBlock = blocks.some(
      (b) => b.type === "text" && b.content.trim(),
    );
    if (!hasTextBlock) {
      setError(t("QUESTION_STATEMENT_REQUIRED"));
      return;
    }

    if (qType === "open_ended") {
      if (!expectedAnswer.trim()) {
        setError(t("QUESTION_EXPECTED_ANSWER_REQUIRED"));
        return;
      }
      if (!passingScore.trim()) {
        setError(t("QUESTION_PASSING_SCORE_REQUIRED"));
        return;
      }
    }

    if (qType === "closed_ended") {
      const filledOptions = options.filter(
        (o) => o.text.trim() || o.images.length > 0,
      );
      if (filledOptions.length < 2) {
        setError(t("QUESTION_OPTIONS_MIN_TWO"));
        return;
      }
      if (!filledOptions.some((o) => o.isCorrect)) {
        setError(t("QUESTION_OPTIONS_NEED_CORRECT"));
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Identify existing images to keep vs remove, and new images to add
      const keptExistingIds = new Set<string>();
      const newImageFiles: File[] = [];
      const newImageBlockIds: string[] = [];

      for (const block of blocks) {
        if (block.type === "image") {
          if (block.existingImage) {
            keptExistingIds.add(block.existingImage.id);
          } else if (block.file) {
            newImageFiles.push(block.file);
            newImageBlockIds.push(block.id);
          }
        }
      }

      const imagesToRemove = initialQuestion.images.filter(
        (img) => !keptExistingIds.has(img.id),
      );

      // 2. Remove deleted images
      for (const img of imagesToRemove) {
        await removeQuestionImage(initialQuestion.id, img.id);
      }

      // 3. Add new images
      let finalImages: QuestionImageResponse[];
      if (newImageFiles.length > 0) {
        const result = await addQuestionImages(
          initialQuestion.id,
          newImageFiles,
        );
        finalImages = result.images;
      } else {
        // Fetch current state after removals
        const current = await getQuestion(initialQuestion.id);
        finalImages = current.images;
      }

      // 4. Build image index map
      // finalImages is ordered by created_at ASC.
      // Existing kept images come first, new images after.
      const keptExisting = finalImages.filter((img) =>
        keptExistingIds.has(img.id),
      );
      const newImages = finalImages.filter(
        (img) => !keptExistingIds.has(img.id),
      );

      const imageIdToIndex = new Map<string, number>();
      finalImages.forEach((img, idx) => imageIdToIndex.set(img.id, idx));

      // Map new blocks to new images (by order of appearance in blocks)
      const newBlockIdToImageId = new Map<string, string>();
      let newIdx = 0;
      for (const blockId of newImageBlockIds) {
        if (newIdx < newImages.length) {
          newBlockIdToImageId.set(blockId, newImages[newIdx].id);
          newIdx++;
        }
      }

      // 5. Build statement with correct indices
      let statement = "";
      for (const block of blocks) {
        if (block.type === "text") {
          if (statement && !statement.endsWith("\n")) statement += "\n";
          statement += block.content;
        } else if (block.type === "image") {
          let imgId: string | undefined;
          if (block.existingImage) {
            imgId = block.existingImage.id;
          } else {
            imgId = newBlockIdToImageId.get(block.id);
          }
          if (imgId) {
            const idx = imageIdToIndex.get(imgId);
            if (idx !== undefined) {
              statement += `\n{{img:${idx}}}\n`;
            }
          }
        }
      }

      // 6. Build update payload
      const updateData: Record<string, unknown> = {
        type: qType,
        statement: statement.trim(),
        exam_id: selectedExamId || "",
        topic_ids: selectedTopics.map((tp) => tp.id),
      };

      if (qType === "open_ended") {
        updateData.expected_answer_text = expectedAnswer.trim() || undefined;
        updateData.passing_score = passingScore.trim()
          ? parseInt(passingScore, 10)
          : undefined;
        updateData.options = [];
      }

      let optionImagesMap: Map<number, File[]> | undefined;

      if (qType === "closed_ended") {
        const validOptions = options.filter(
          (o) => o.text.trim() || o.images.length > 0,
        );
        updateData.options = validOptions.map((o) => ({
          text: o.text.trim() || undefined,
          is_correct: o.isCorrect,
          image_ids: o.images
            .filter((img) => img.existingId)
            .map((img) => img.existingId!),
        }));

        const imgMap = new Map<number, File[]>();
        validOptions.forEach((o, idx) => {
          const newFiles = o.images
            .filter((img) => img.file)
            .map((img) => img.file!);
          if (newFiles.length > 0) imgMap.set(idx, newFiles);
        });
        if (imgMap.size > 0) optionImagesMap = imgMap;
      }

      await updateQuestion(initialQuestion.id, updateData, optionImagesMap);
      onSaved();
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

  // ---- Preview data ----

  function buildPreviewStatement(): string {
    let s = "";
    let imgIdx = 0;
    for (const block of blocks) {
      if (block.type === "text") {
        if (s && !s.endsWith("\n")) s += "\n";
        s += block.content;
      } else {
        s += `\n{{img:${imgIdx}}}\n`;
        imgIdx++;
      }
    }
    return s.trim();
  }

  function buildPreviewImages(): QuestionImageResponse[] {
    return blocks
      .filter((b) => b.type === "image")
      .map((b, i) => {
        if (b.existingImage) {
          return {
            id: b.existingImage.id,
            filename: b.existingImage.filename,
            content_type: "",
            size_bytes: 0,
            url: b.existingImage.url,
          };
        }
        if (b.file) {
          return {
            id: `preview-${i}`,
            filename: b.file.name,
            content_type: b.file.type,
            size_bytes: b.file.size,
            url: URL.createObjectURL(b.file),
          };
        }
        return null;
      })
      .filter(Boolean) as QuestionImageResponse[];
  }

  // ---- Render ----

  const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const isCreate = mode === "create";

  return (
    <>
      <form onSubmit={isCreate ? handleCreate : handleEdit}>
        {/* Mobile Warning */}
        <div className="flex flex-col items-center justify-center py-20 text-center lg:hidden">
          <div className="mb-6 rounded-full bg-surface p-4">
            <Monitor className="h-10 w-10 text-muted" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-heading">
            {t("QUESTION_DESKTOP_ONLY_TITLE")}
          </h2>
          <p className="mb-8 max-w-sm text-sm text-muted">
            {t("QUESTION_DESKTOP_ONLY_DESC")}
          </p>
          <Button type="button" variant="outline" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("QUESTION_BACK")}
          </Button>
        </div>

        {/* Desktop Editor */}
        <div className="hidden lg:block">
          {/* Sticky toolbar */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-heading"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("QUESTION_BACK")}
              </button>
              <h1 className="text-xl font-bold text-heading">
                {isCreate ? t("QUESTION_CREATE_TITLE") : t("QUESTION_EDIT_TITLE")}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm text-muted transition-colors hover:text-heading"
              >
                {showPreview ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {t("QUESTION_PREVIEW_TOGGLE")}
              </button>
              <Button type="submit" loading={loading}>
                {isCreate ? t("QUESTION_CREATE_SUBMIT") : t("PROFILE_SAVE")}
              </Button>
            </div>
          </div>

          <div
            className={
              showPreview ? "grid gap-6 lg:grid-cols-2" : "mx-auto max-w-6xl"
            }
          >
            {/* ---------- Editor column ---------- */}
            <div className="space-y-6">
              {/* Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-heading">
                {t("QUESTION_TYPE_LABEL")}
              </label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-body outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="closed_ended">
                  {t("QUESTION_TYPE_CLOSED_ENDED")}
                </option>
                <option value="open_ended">
                  {t("QUESTION_TYPE_OPEN_ENDED")}
                </option>
              </select>
            </div>

            {/* Exam */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-heading">
                {t("QUESTION_EXAM_LABEL")}
              </label>
              <SearchableSelect
                value={selectedExamId}
                onChange={setSelectedExamId}
                options={exams.map((exam) => ({
                  value: exam.id,
                  label: `${exam.institution.acronym} — ${exam.title} (${exam.year})`,
                }))}
                onSearch={async (q) => {
                  const res = await listExams(1, 50, q ? { search: q } : undefined);
                  return (res.data ?? []).map((exam) => ({
                    value: exam.id,
                    label: `${exam.institution.acronym} — ${exam.title} (${exam.year})`,
                  }));
                }}
                placeholder={t("QUESTION_EXAM_NONE")}
                searchPlaceholder={t("SEARCHABLE_SELECT_SEARCH_PLACEHOLDER")}
                emptyMessage={t("SEARCHABLE_SELECT_EMPTY")}
                className="w-full"
              />
            </div>

            {/* Statement (block editor) */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-heading">
                {t("QUESTION_STATEMENT_LABEL")}
              </label>
              <p className="text-xs text-muted">{t("QUESTION_LATEX_HINT")}</p>

              <div className="space-y-2">
                {blocks.map((block, idx) => (
                  <div key={block.id}>
                    {/* Block */}
                    {block.type === "text" ? (
                      <div className="group relative rounded-lg border border-surface-border bg-background">
                        <LatexToolbar
                          inputRef={{
                            current:
                              blockTextareaRefs.current.get(block.id) ?? null,
                          }}
                          onInsert={(v) => updateBlockContent(idx, v)}
                        />
                        <textarea
                          ref={(el) => {
                            if (el) blockTextareaRefs.current.set(block.id, el);
                          }}
                          value={block.content}
                          onChange={(e) =>
                            updateBlockContent(idx, e.target.value)
                          }
                          rows={Math.max(
                            3,
                            block.content.split("\n").length + 1,
                          )}
                          placeholder={t("QUESTION_STATEMENT_PLACEHOLDER")}
                          className="w-full resize-none rounded-b-lg bg-transparent px-4 py-3 pr-20 font-mono text-sm text-body placeholder:text-muted outline-none"
                        />
                        <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveBlock(idx, "up")}
                              className="rounded p-1 text-muted hover:text-heading"
                              title={t("QUESTION_BLOCK_MOVE_UP")}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {idx < blocks.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveBlock(idx, "down")}
                              className="rounded p-1 text-muted hover:text-heading"
                              title={t("QUESTION_BLOCK_MOVE_DOWN")}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {blocks.filter((b) => b.type === "text").length >
                            1 && (
                            <button
                              type="button"
                              onClick={() => removeBlock(idx)}
                              className="rounded p-1 text-muted hover:text-error"
                              title={t("QUESTION_BLOCK_REMOVE")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3">
                        <ImagePlus className="h-5 w-5 shrink-0 text-secondary" />
                        <div className="min-w-0 flex-1">
                          {block.existingImage ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={block.existingImage.url}
                                alt={block.existingImage.filename}
                                className="h-16 max-w-[200px] rounded border border-surface-border object-contain"
                              />
                              <span className="truncate text-sm text-body">
                                {block.existingImage.filename}
                              </span>
                            </div>
                          ) : block.file ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={URL.createObjectURL(block.file)}
                                alt={block.file.name}
                                className="h-16 max-w-[200px] rounded border border-surface-border object-contain"
                              />
                              <span className="truncate text-sm text-body">
                                {block.file.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted">
                              {t("QUESTION_BLOCK_IMAGE_EMPTY")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveBlock(idx, "up")}
                              className="rounded p-1 text-muted hover:text-heading"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {idx < blocks.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveBlock(idx, "down")}
                              className="rounded p-1 text-muted hover:text-heading"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeBlock(idx)}
                            className="rounded p-1 text-muted hover:text-error"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Insert bar between blocks */}
                    <div className="flex items-center justify-center gap-1 py-1">
                      <button
                        type="button"
                        onClick={() => addBlock("text", idx)}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted transition-colors hover:bg-surface-light hover:text-heading"
                      >
                        <Type className="h-3 w-3" />
                        {t("QUESTION_BLOCK_ADD_TEXT")}
                      </button>
                      <span className="text-muted/40">|</span>
                      <input
                        ref={(el) => {
                          if (el)
                            blockImageRefs.current.set(
                              `insert-${block.id}`,
                              el,
                            );
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) addImageBlock(idx, file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          blockImageRefs.current
                            .get(`insert-${block.id}`)
                            ?.click()
                        }
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted transition-colors hover:bg-surface-light hover:text-heading"
                      >
                        <ImagePlus className="h-3 w-3" />
                        {t("QUESTION_BLOCK_ADD_IMAGE")}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Initial insert bar when there are no blocks */}
                {blocks.length === 0 && (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border py-8">
                    <button
                      type="button"
                      onClick={() =>
                        setBlocks([{ id: uid(), type: "text", content: "" }])
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3 py-2 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
                    >
                      <Type className="h-4 w-4" />
                      {t("QUESTION_BLOCK_ADD_TEXT")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Open-ended fields */}
            {qType === "open_ended" && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-heading">
                    {t("QUESTION_EXPECTED_ANSWER_LABEL")}
                    <span className="text-error"> *</span>
                  </label>
                  <div className="rounded-lg border border-surface-border bg-background transition-colors focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary">
                    <LatexToolbar
                      inputRef={expectedAnswerRef}
                      onInsert={(v) => setExpectedAnswer(v)}
                    />
                    <textarea
                      ref={expectedAnswerRef}
                      value={expectedAnswer}
                      onChange={(e) => setExpectedAnswer(e.target.value)}
                      placeholder={t("QUESTION_EXPECTED_ANSWER_PLACEHOLDER")}
                      rows={3}
                      className="w-full rounded-b-lg bg-transparent px-4 py-2.5 font-mono text-sm text-body placeholder:text-muted outline-none"
                    />
                  </div>
                  {showPreview && expectedAnswer.trim() && (
                    <div className="rounded-lg border border-surface-border bg-background p-3 text-sm text-body">
                      <LatexText text={expectedAnswer} as="div" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-heading">
                    {t("QUESTION_PASSING_SCORE_LABEL")}
                    <span className="text-error"> *</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    placeholder={t("QUESTION_PASSING_SCORE_PLACEHOLDER")}
                    className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </>
            )}

            {/* Closed-ended options */}
            {qType === "closed_ended" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-heading">
                  {t("QUESTION_OPTIONS_LABEL")}
                  <span className="text-error"> *</span>
                </label>
                <div className="space-y-3">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-surface-border bg-background p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs font-semibold text-muted w-5 text-center">
                          {OPTION_LETTERS[idx] ?? idx + 1}
                        </span>
                        <input
                          type="checkbox"
                          checked={opt.isCorrect}
                          onChange={(e) =>
                            updateOption(idx, "isCorrect", e.target.checked)
                          }
                          title={t("QUESTION_OPTION_CORRECT")}
                          className="h-4 w-4 shrink-0 rounded border-surface-border text-secondary focus:ring-secondary"
                        />
                        <div className="flex-1">
                          <LatexToolbar
                            inputRef={{
                              current:
                                optionTextareaRefs.current.get(idx) ?? null,
                            }}
                            onInsert={(v) => updateOption(idx, "text", v)}
                            compact
                          />
                          <textarea
                            ref={(el) => {
                              if (el) optionTextareaRefs.current.set(idx, el);
                            }}
                            value={opt.text}
                            onChange={(e) =>
                              updateOption(idx, "text", e.target.value)
                            }
                            rows={Math.max(2, opt.text.split("\n").length + 1)}
                            placeholder={`${t("QUESTION_OPTION_PLACEHOLDER")} ${OPTION_LETTERS[idx] ?? idx + 1}`}
                            className="w-full resize-none rounded-b-lg border border-t-0 border-surface-border bg-surface px-3 py-2 font-mono text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
                          />
                        </div>
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(idx)}
                            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-error/10 hover:text-error"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Option images */}
                      <div className="ml-10 space-y-2">
                        {opt.images.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {opt.images.map((img, imgIdx) => (
                              <div
                                key={img.id}
                                className="group/img relative inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface p-1.5"
                              >
                                <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white">
                                  {imgIdx}
                                </span>
                                {img.existingUrl ? (
                                  <img
                                    src={img.existingUrl}
                                    alt={img.existingFilename ?? ""}
                                    className="h-12 max-w-[80px] rounded object-contain"
                                  />
                                ) : img.file ? (
                                  <img
                                    src={URL.createObjectURL(img.file)}
                                    alt={img.file.name}
                                    className="h-12 max-w-[80px] rounded object-contain"
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOptions((prev) =>
                                      prev.map((o, i) =>
                                        i === idx
                                          ? {
                                              ...o,
                                              images: o.images.filter(
                                                (_, ii) => ii !== imgIdx,
                                              ),
                                            }
                                          : o,
                                      ),
                                    );
                                  }}
                                  className="rounded-full p-0.5 text-muted opacity-0 transition-opacity hover:text-error group-hover/img:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => {
                              if (el) optionImageRefs.current.set(idx, el);
                            }}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              if (file) {
                                const newImg: OptionImageDraft = {
                                  id: uid(),
                                  file,
                                };
                                const newImages = [...opt.images, newImg];
                                const marker = `{{img:${opt.images.length}}}`;
                                const ta = optionTextareaRefs.current.get(idx);
                                let newText = opt.text;
                                if (ta) {
                                  const start =
                                    ta.selectionStart ?? opt.text.length;
                                  newText =
                                    opt.text.slice(0, start) +
                                    marker +
                                    opt.text.slice(start);
                                } else {
                                  newText = opt.text + marker;
                                }
                                setOptions((prev) =>
                                  prev.map((o, i) =>
                                    i === idx
                                      ? {
                                          ...o,
                                          text: newText,
                                          images: newImages,
                                        }
                                      : o,
                                  ),
                                );
                              }
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              optionImageRefs.current.get(idx)?.click()
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-surface-border px-2 py-1 text-xs text-muted transition-colors hover:border-secondary hover:text-heading"
                          >
                            <ImagePlus className="h-3 w-3" />
                            {t("QUESTION_OPTION_ADD_IMAGE")}
                          </button>
                          {opt.images.length > 0 && (
                            <span className="text-[10px] text-muted">
                              {t("QUESTION_LATEX_HINT")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOption}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3 py-2 text-sm text-muted transition-colors hover:border-secondary hover:text-heading"
                >
                  <Plus className="h-4 w-4" />
                  {t("QUESTION_ADD_OPTION")}
                </button>
                <p className="text-xs text-muted">
                  {t("QUESTION_OPTIONS_HINT")}
                </p>
              </div>
            )}

            {/* Topics */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-heading">
                {t("QUESTION_TOPICS_LABEL")}
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
                        onClick={() =>
                          setSelectedTopics((prev) =>
                            prev.filter((t) => t.id !== topic.id),
                          )
                        }
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
                {t("QUESTION_ADD_TOPIC")}
              </button>
            </div>

            {/* Error */}
            {error && <p className="text-sm text-error">{error}</p>}

            {/* Bottom submit */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                {t("PROFILE_CANCEL")}
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                {isCreate ? t("QUESTION_CREATE_SUBMIT") : t("PROFILE_SAVE")}
              </Button>
            </div>
          </div>

          {/* ---------- Preview column ---------- */}
          {showPreview && (
            <div className="rounded-xl border border-surface-border bg-white p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <div className="mb-4">
                <div
                  className="mb-2 h-0.5 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #cfa156 0%, #dbb778 50%, #cfa156 100%)",
                  }}
                />
                <h2
                  className="text-sm font-bold tracking-tight"
                  style={{ color: "#0f2e2e" }}
                >
                  {t("QUESTION_PREVIEW_TITLE")}
                </h2>
              </div>

              <StatementRenderer
                statement={buildPreviewStatement()}
                images={buildPreviewImages()}
                className="text-gray-800"
                imageClassName="my-4 max-w-full rounded-lg border border-gray-200 object-contain"
              />

              {qType === "closed_ended" &&
                options.some((o) => o.text.trim() || o.images.length > 0) && (
                  <div className="mt-6 space-y-3">
                    {options
                      .filter((o) => o.text.trim() || o.images.length > 0)
                      .map((opt, idx) => {
                        const optPreviewImages = opt.images
                          .map((img, i) => {
                            if (img.existingUrl) {
                              return {
                                id: img.existingId ?? `opt-existing-${i}`,
                                filename: img.existingFilename ?? "",
                                content_type: "",
                                size_bytes: 0,
                                url: img.existingUrl,
                              };
                            }
                            if (img.file) {
                              return {
                                id: `opt-preview-${i}`,
                                filename: img.file.name,
                                content_type: img.file.type,
                                size_bytes: img.file.size,
                                url: URL.createObjectURL(img.file),
                              };
                            }
                            return null;
                          })
                          .filter(Boolean) as QuestionImageResponse[];

                        return (
                          <div
                            key={idx}
                            className="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3"
                          >
                            <span className="mt-0.5 shrink-0 text-sm font-semibold text-gray-700">
                              {OPTION_LETTERS[idx] ?? idx + 1})
                            </span>
                            <div className="flex-1">
                              <StatementRenderer
                                statement={opt.text}
                                images={optPreviewImages}
                                className="text-sm text-gray-700 leading-relaxed"
                                imageClassName="my-2 max-h-32 max-w-[200px] rounded border border-gray-200 object-contain"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

              {qType === "open_ended" && expectedAnswer.trim() && (
                <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t("QUESTION_PREVIEW_EXPECTED_ANSWER")}
                  </p>
                  <LatexText
                    text={expectedAnswer}
                    as="div"
                    className="text-sm text-gray-700 leading-relaxed"
                  />
                </div>
              )}

              <div className="mt-6 pt-3">
                <div
                  className="h-0.5 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #cfa156 0%, #dbb778 50%, #cfa156 100%)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </form>

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
    </>
  );
}
