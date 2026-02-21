"use client";

import { useState, useEffect, use } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send, Brain, Cpu, BookOpen } from "lucide-react";
import { getQuestion, type QuestionResponse } from "@/lib/questions";
import {
  submitAnswer,
  type QuestionSubmissionResponse,
} from "@/lib/submissions";
import { LatexText } from "@/components/ui/latex-text";
import { StatementRenderer } from "@/components/questions/statement-renderer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createQuestionFeedback } from "@/lib/questions";

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

  // Feedback State
  const [feedbackLogic, setFeedbackLogic] = useState<number>(2);
  const [feedbackLabor, setFeedbackLabor] = useState<number>(2);
  const [feedbackTheory, setFeedbackTheory] = useState<number>(2);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

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

  async function handleFeedbackSubmit() {
    if (!question || feedbackSubmitting || feedbackSubmitted) return;
    setFeedbackSubmitting(true);
    try {
      await createQuestionFeedback(question.id, {
        difficulty_logic: feedbackLogic,
        difficulty_labor: feedbackLabor,
        difficulty_theory: feedbackTheory,
      });
      setFeedbackSubmitted(true);
      toast(t("FEEDBACK_SUBMITTED_SUCCESS"));
    } catch {
      toast(t("ERROR_INTERNAL_ERROR"));
    } finally {
      setFeedbackSubmitting(false);
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

      <div className="rounded-lg border border-surface-border bg-surface p-4 sm:p-6">
        {/* Question metadata */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-surface-light px-2 py-0.5">
            {question.type === "open_ended"
              ? t("QUESTION_TYPE_OPEN_ENDED")
              : t("QUESTION_TYPE_CLOSED_ENDED")}
          </span>
          {question.exam && (
            <span className="rounded-full border border-surface-border bg-surface-light px-2 py-0.5 text-muted">
              {question.exam.institution_acronym || question.exam.institution} ·{" "}
              {question.exam.title} ({question.exam.year})
            </span>
          )}
          {question.median_difficulty !== undefined && question.median_difficulty !== null && (
            <div className="flex gap-1.5 flex-wrap">
              {question.median_logic !== undefined && question.median_logic !== null && (
                <span
                  className={`group/logic relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase cursor-default ${question.median_logic >= 2.25
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : question.median_logic >= 1.25
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}
                >
                  <Brain className="h-3 w-3" />
                  {question.median_logic >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : question.median_logic >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/logic:opacity-100">{t("FEEDBACK_LOGIC")}</span>
                </span>
              )}
              {question.median_labor !== undefined && question.median_labor !== null && (
                <span
                  className={`group/labor relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase cursor-default ${question.median_labor >= 2.25
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : question.median_labor >= 1.25
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}
                >
                  <Cpu className="h-3 w-3" />
                  {question.median_labor >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : question.median_labor >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/labor:opacity-100">{t("FEEDBACK_LABOR")}</span>
                </span>
              )}
              {question.median_theory !== undefined && question.median_theory !== null && (
                <span
                  className={`group/theory relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase cursor-default ${question.median_theory >= 2.25
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : question.median_theory >= 1.25
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}
                >
                  <BookOpen className="h-3 w-3" />
                  {question.median_theory >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : question.median_theory >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/theory:opacity-100">{t("FEEDBACK_THEORY")}</span>
                </span>
              )}
            </div>
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
            className={`mb-6 rounded-lg p-4 ${result.passed
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
              const revealCorrect = showResult && result.passed;

              let borderClass = "border-surface-border";
              if (revealCorrect && isCorrectOption) {
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
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${borderClass} ${result == null
                    ? "hover:border-secondary hover:bg-secondary/5"
                    : ""
                    } disabled:cursor-default`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${!showResult && isSelected
                      ? "border-secondary bg-secondary text-white"
                      : revealCorrect && isCorrectOption
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
                  {revealCorrect && isCorrectOption && (
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

        {/* After submission actions & Feedback Block */}
        {result && (
          <div className="mt-8 border-t border-surface-border pt-6">
            {!feedbackSubmitted ? (
              <div className="mb-8 rounded-lg border border-surface-border bg-surface-light p-4 animate-in fade-in slide-in-from-bottom-2">
                <h4 className="mb-5 text-sm font-semibold text-heading">
                  {t("SUBMISSION_FEEDBACK_TITLE", { defaultValue: "How difficult was this question?" })}
                </h4>
                <div className="space-y-6">
                  {/* Logic Feedback */}
                  <div>
                    <div className="mb-3 flex justify-between text-xs font-medium text-heading">
                      <span>{t("FEEDBACK_LOGIC", { defaultValue: "Logic/Reasoning" })}</span>
                    </div>
                    <div className="flex w-full overflow-hidden rounded-lg border border-surface-border bg-surface">
                      {[1, 2, 3].map((val) => (
                        <button
                          key={`logic-${val}`}
                          onClick={() => setFeedbackLogic(val)}
                          className={`flex-1 py-2 text-xs font-medium transition-colors ${feedbackLogic === val
                            ? "bg-secondary text-primary-dark font-bold shadow-md"
                            : "text-muted hover:bg-surface-light hover:text-heading"
                            }`}
                        >
                          {val === 1 ? t("FEEDBACK_LEVEL_LOW", { defaultValue: "Low" }) : val === 2 ? t("FEEDBACK_LEVEL_MEDIUM", { defaultValue: "Medium" }) : t("FEEDBACK_LEVEL_HIGH", { defaultValue: "High" })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Labor Feedback */}
                  <div>
                    <div className="mb-3 flex justify-between text-xs font-medium text-heading">
                      <span>{t("FEEDBACK_LABOR", { defaultValue: "Computational Labor" })}</span>
                    </div>
                    <div className="flex w-full overflow-hidden rounded-lg border border-surface-border bg-surface">
                      {[1, 2, 3].map((val) => (
                        <button
                          key={`labor-${val}`}
                          onClick={() => setFeedbackLabor(val)}
                          className={`flex-1 py-2 text-xs font-medium transition-colors ${feedbackLabor === val
                            ? "bg-secondary text-primary-dark font-bold shadow-md"
                            : "text-muted hover:bg-surface-light hover:text-heading"
                            }`}
                        >
                          {val === 1 ? t("FEEDBACK_LEVEL_LOW", { defaultValue: "Low" }) : val === 2 ? t("FEEDBACK_LEVEL_MEDIUM", { defaultValue: "Medium" }) : t("FEEDBACK_LEVEL_HIGH", { defaultValue: "High" })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theory Feedback */}
                  <div>
                    <div className="mb-3 flex justify-between text-xs font-medium text-heading">
                      <span>{t("FEEDBACK_THEORY", { defaultValue: "Theoretical Knowledge" })}</span>
                    </div>
                    <div className="flex w-full overflow-hidden rounded-lg border border-surface-border bg-surface">
                      {[1, 2, 3].map((val) => (
                        <button
                          key={`theory-${val}`}
                          onClick={() => setFeedbackTheory(val)}
                          className={`flex-1 py-2 text-xs font-medium transition-colors ${feedbackTheory === val
                            ? "bg-secondary text-primary-dark font-bold shadow-md"
                            : "text-muted hover:bg-surface-light hover:text-heading"
                            }`}
                        >
                          {val === 1 ? t("FEEDBACK_LEVEL_LOW", { defaultValue: "Low" }) : val === 2 ? t("FEEDBACK_LEVEL_MEDIUM", { defaultValue: "Medium" }) : t("FEEDBACK_LEVEL_HIGH", { defaultValue: "High" })}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      size="sm"
                      loading={feedbackSubmitting}
                      onClick={handleFeedbackSubmit}
                      className="w-full sm:w-auto shadow-md"
                    >
                      {t("FEEDBACK_SUBMIT_BUTTON", { defaultValue: "Send Feedback" })}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8 rounded-lg bg-green-500/10 p-3 text-center text-sm font-medium text-green-500 border border-green-500/20">
                {t("FEEDBACK_SUBMITTED_MESSAGE", { defaultValue: "Thank you for your feedback!" })}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setSelectedOption(null);
                  setAnswerText("");
                  setFeedbackSubmitted(false);
                  setFeedbackLogic(2);
                  setFeedbackLabor(2);
                  setFeedbackTheory(2);
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
          </div>
        )}
      </div>
    </div>
  );
}
