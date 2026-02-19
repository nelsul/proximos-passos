"use client";

import { useState, useEffect, use } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send } from "lucide-react";
import { getQuestion, type QuestionResponse } from "@/lib/questions";
import {
  submitAnswer,
  type QuestionSubmissionResponse,
} from "@/lib/submissions";
import { LatexText } from "@/components/ui/latex-text";
import { StatementRenderer } from "@/components/questions/statement-renderer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function AnswerQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activity") ?? undefined;
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuestionSubmissionResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const q = await getQuestion(id);
        setQuestion(q);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit() {
    if (!question || submitting) return;

    if (question.type === "closed_ended" && !selectedOption) {
      toast(t("SUBMISSION_SELECT_OPTION"));
      return;
    }
    if (question.type === "open_ended" && !answerText.trim()) {
      toast(t("SUBMISSION_ENTER_ANSWER"));
      return;
    }

    setSubmitting(true);
    try {
      const sub = await submitAnswer(question.id, {
        question_option_id:
          question.type === "closed_ended" ? selectedOption! : undefined,
        answer_text:
          question.type === "open_ended" ? answerText.trim() : undefined,
        activity_id: activityId,
      });
      setResult(sub);
    } catch {
      toast(t("ERROR_INTERNAL_ERROR"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">{t("ERROR_QUESTION_NOT_FOUND")}</p>
      </div>
    );
  }

  const isClosedEnded = question.type === "closed_ended";

  return (
    <div>
      <button
        onClick={() => {
          if (activityId) {
            router.push(`/${locale}/dashboard/activities/${activityId}`);
          } else {
            router.push(`/${locale}/dashboard/questions`);
          }
        }}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        {activityId
          ? t("ACTIVITY_BACK_TO_ACTIVITY")
          : t("SUBMISSION_BACK_TO_QUESTIONS")}
      </button>

      <div className="rounded-lg border border-surface-border bg-surface p-6">
        {/* Question metadata */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-surface-light px-2 py-0.5">
            {question.type === "open_ended"
              ? t("QUESTION_TYPE_OPEN_ENDED")
              : t("QUESTION_TYPE_CLOSED_ENDED")}
          </span>
          {question.exam && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {question.exam.institution} — {question.exam.title} (
              {question.exam.year})
            </span>
          )}
          {question.topics.map((topic) => (
            <span
              key={topic.id}
              className="rounded-full bg-secondary/10 px-2 py-0.5 text-secondary"
            >
              {topic.name}
            </span>
          ))}
        </div>

        {/* Question statement */}
        <StatementRenderer
          statement={question.statement}
          images={question.images}
          className="mb-6 text-heading leading-relaxed"
        />

        {/* Result banner */}
        {result && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              result.passed
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {result.passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span className="font-semibold">
                {result.passed
                  ? t("SUBMISSION_CORRECT")
                  : t("SUBMISSION_INCORRECT")}
              </span>
              {result.score != null && (
                <span className="ml-auto text-sm font-medium">
                  {t("SUBMISSION_SCORE")}: {result.score}%
                </span>
              )}
            </div>
            {result.answer_feedback && (
              <p className="mt-2 text-sm">{result.answer_feedback}</p>
            )}
          </div>
        )}

        {/* Answer area */}
        {isClosedEnded ? (
          <div className="space-y-2">
            <h3 className="mb-2 text-sm font-medium text-heading">
              {t("SUBMISSION_SELECT_ANSWER")}
            </h3>
            {question.options.map((opt, idx) => {
              const isSelected = selectedOption === opt.id;
              const showResult = result != null;
              const isCorrectOption = opt.is_correct;
              const wasSelected = result?.option_selected?.id === opt.id;

              let borderClass = "border-surface-border";
              if (showResult && isCorrectOption) {
                borderClass = "border-green-400 bg-green-50";
              } else if (showResult && wasSelected && !isCorrectOption) {
                borderClass = "border-red-400 bg-red-50";
              } else if (!showResult && isSelected) {
                borderClass = "border-secondary bg-secondary/5";
              }

              return (
                <button
                  key={opt.id}
                  disabled={result != null}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${borderClass} ${
                    result == null
                      ? "hover:border-secondary hover:bg-secondary/5"
                      : ""
                  } disabled:cursor-default`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      !showResult && isSelected
                        ? "border-secondary bg-secondary text-white"
                        : showResult && isCorrectOption
                          ? "border-green-500 bg-green-500 text-white"
                          : showResult && wasSelected && !isCorrectOption
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-surface-border text-muted"
                    }`}
                  >
                    {OPTION_LETTERS[idx] ?? idx + 1}
                  </span>
                  <div className="flex-1">
                    {opt.text && <LatexText text={opt.text} />}
                    {opt.images?.map((img) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt={img.filename}
                        className="mt-2 max-h-48 max-w-full rounded border border-gray-200 object-contain"
                      />
                    ))}
                  </div>
                  {showResult && isCorrectOption && (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  )}
                  {showResult && wasSelected && !isCorrectOption && (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <h3 className="mb-2 text-sm font-medium text-heading">
              {t("SUBMISSION_YOUR_ANSWER")}
            </h3>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={result != null}
              rows={6}
              placeholder={t("SUBMISSION_ANSWER_PLACEHOLDER")}
              className="w-full rounded-lg border border-surface-border bg-background p-3 text-sm text-body placeholder:text-muted outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary disabled:opacity-60"
            />
          </div>
        )}

        {/* Submit button */}
        {!result && (
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              loading={submitting}
              onClick={handleSubmit}
              className="w-auto"
            >
              <Send className="h-4 w-4" />
              {t("SUBMISSION_SUBMIT_BUTTON")}
            </Button>
          </div>
        )}

        {/* After submission actions */}
        {result && (
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setResult(null);
                setSelectedOption(null);
                setAnswerText("");
              }}
              className="w-auto"
            >
              {t("SUBMISSION_TRY_AGAIN")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/${locale}/dashboard/submissions`)}
              className="w-auto"
            >
              {t("SUBMISSION_VIEW_HISTORY")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
