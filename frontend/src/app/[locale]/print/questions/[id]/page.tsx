"use client";

import { useState, useEffect, use } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { getQuestion, type QuestionResponse } from "@/lib/questions";
import { LatexText } from "@/components/ui/latex-text";
import { StatementRenderer } from "@/components/questions/statement-renderer";
import { BRAND_ASSETS } from "@/config/assets";

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function PrintQuestionPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">{t("ERROR_QUESTION_NOT_FOUND")}</p>
      </div>
    );
  }

  const isClosedEnded = question.type === "closed_ended";
  const correctOptions = question.options.filter((o) => o.is_correct);

  return (
    <>
      {/* Toolbar – hidden when printing */}
      <div className="print:hidden fixed top-0 inset-x-0 z-50 flex items-center justify-between border-b border-surface-border bg-surface px-6 py-3">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("QUESTION_PRINT_BACK")}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-primary-dark transition-colors hover:bg-secondary-light"
        >
          <Printer className="h-4 w-4" />
          {t("QUESTION_PRINT_BUTTON")}
        </button>
      </div>

      {/* Page 1 – Question */}
      <div className="print-page">
        <div className="print-page-inner">
          {/* Header: logo + app name */}
          <div className="print-header">
            <div className="print-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND_ASSETS.logo.full.low}
                alt="Próximos Passos"
                className="print-brand-logo"
              />
            </div>
            <div className="print-header-line" />
          </div>

          {/* Statement */}
          <div className="print-section">
            <StatementRenderer
              statement={question.statement}
              images={question.images}
              className="print-statement"
              imageClassName="my-2 max-w-full max-h-48 rounded border border-gray-200 object-contain"
            />
          </div>

          {/* Options (closed ended) */}
          {isClosedEnded && question.options.length > 0 && (
            <div className="print-options">
              {question.options.map((opt, idx) => (
                <div key={opt.id} className="print-option">
                  <span className="print-option-letter">
                    {OPTION_LETTERS[idx] ?? idx + 1})
                  </span>
                  <div className="flex-1">
                    <StatementRenderer
                      statement={opt.text ?? ""}
                      images={opt.images ?? []}
                      className="print-option-text"
                      imageClassName="print-option-image"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Answer area (open ended) */}
          {!isClosedEnded && (
            <div className="print-answer-area">
              <div className="print-answer-lines">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="print-answer-line" />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="print-footer">
            <div className="print-footer-line" />
          </div>
        </div>
      </div>

      {/* Page 2 – Answer Key (compact) */}
      <div className="print-page print-page-break">
        <div className="print-page-inner">
          <div className="print-header">
            <div className="print-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND_ASSETS.logo.full.low}
                alt="Próximos Passos"
                className="print-brand-logo"
              />
            </div>
            <div className="print-header-line" />
          </div>

          <h2 className="print-title mb-3">{t("QUESTION_PRINT_ANSWER_KEY")}</h2>

          {isClosedEnded ? (
            <div className="print-answer-key-table">
              <span className="print-answer-key-label">01</span>
              <span className="print-answer-key-value">
                {correctOptions
                  .map((opt) => {
                    const idx = question.options.findIndex(
                      (o) => o.id === opt.id,
                    );
                    return OPTION_LETTERS[idx] ?? idx + 1;
                  })
                  .join(", ")}
              </span>
            </div>
          ) : (
            <div className="print-section">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {t("QUESTION_PRINT_EXPECTED_ANSWER")}
              </p>
              {question.expected_answer_text ? (
                <LatexText
                  text={question.expected_answer_text}
                  as="div"
                  className="text-sm text-gray-700 leading-relaxed"
                />
              ) : (
                <p className="text-sm text-gray-400 italic">—</p>
              )}
              {question.passing_score != null && (
                <p className="mt-1 text-xs text-gray-500">
                  {t("QUESTION_PASSING_SCORE_LABEL")}: {question.passing_score}%
                </p>
              )}
            </div>
          )}

          <div className="print-footer">
            <div className="print-footer-line" />
          </div>
        </div>
      </div>
    </>
  );
}
