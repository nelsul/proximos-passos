"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { QuestionForm } from "@/components/questions/question-form";

export default function NewQuestionPage() {
  const router = useRouter();
  const locale = useLocale();

  return (
    <QuestionForm
      mode="create"
      onSaved={() =>
        router.push(`/${locale}/dashboard/questions?success=created`)
      }
      onCancel={() => router.push(`/${locale}/dashboard/questions`)}
    />
  );
}
