"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { getQuestion, type QuestionResponse } from "@/lib/questions";
import { QuestionForm } from "@/components/questions/question-form";

export default function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const locale = useLocale();
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

  return (
    <QuestionForm
      mode="edit"
      initialQuestion={question}
      onSaved={() =>
        router.push(`/${locale}/dashboard/questions?success=updated`)
      }
      onCancel={() => router.push(`/${locale}/dashboard/questions`)}
    />
  );
}
