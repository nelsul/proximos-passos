import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
    HelpCircle,
    Video,
    FileText,
    BookOpen,
    ListChecks,
    CheckCircle2,
    XCircle,
    PenLine,
    ExternalLink,
    Loader2,
    Brain,
    Cpu,
} from "lucide-react";
import { type ActivityItemResponse } from "@/lib/activities";
import { getVideoLesson } from "@/lib/video-lessons";
import { getHandout } from "@/lib/handouts";
import { getExerciseList } from "@/lib/open-exercise-lists";
import { type QuestionStatusResponse } from "@/lib/activity-submissions";
import { LatexText } from "@/components/ui/latex-text";
import { stripImageMarkers } from "@/components/questions/statement-renderer";

export const TYPE_ICONS: Record<string, typeof HelpCircle> = {
    question: HelpCircle,
    video_lesson: Video,
    handout: FileText,
    open_exercise_list: BookOpen,
    simulated_exam: ListChecks,
};

export const TYPE_COLORS: Record<string, string> = {
    question: "text-purple-400",
    video_lesson: "text-blue-400",
    handout: "text-secondary",
    open_exercise_list: "text-green-400",
    simulated_exam: "text-amber-400",
};

interface ItemRowProps {
    item: ActivityItemResponse;
    index: number;
    activityId: string;
    questionStatus?: QuestionStatusResponse;
    t: (key: string, values?: any) => string;
}

export function ItemRow({ item, index, activityId, questionStatus, t }: ItemRowProps) {
    const Icon = TYPE_ICONS[item.type] ?? ListChecks;
    const color = TYPE_COLORS[item.type] ?? "text-muted";
    const locale = useLocale();
    const [opening, setOpening] = useState(false);

    async function handleOpen() {
        setOpening(true);
        try {
            let url: string | undefined;
            if (item.type === "video_lesson" && item.video_lesson_id) {
                const vl = await getVideoLesson(item.video_lesson_id);
                url = vl.video_url || vl.file?.url;
            } else if (item.type === "handout" && item.handout_id) {
                const h = await getHandout(item.handout_id);
                url = h.file?.url;
            } else if (
                item.type === "open_exercise_list" &&
                item.open_exercise_list_id
            ) {
                const el = await getExerciseList(item.open_exercise_list_id);
                url = el.file_url || el.file?.url;
            }
            if (url) {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        } catch {
            // silently fail
        } finally {
            setOpening(false);
        }
    }

    const hasOpenAction =
        (item.type === "video_lesson" && item.video_lesson_id) ||
        (item.type === "handout" && item.handout_id) ||
        (item.type === "open_exercise_list" && item.open_exercise_list_id);

    const hasLinkAction =
        item.type === "simulated_exam" && item.simulated_exam_id;

    let subtitle = item.content_subtitle;
    if (item.type === "question" && subtitle) {
        subtitle = stripImageMarkers(subtitle);
        // Strip newlines to keep the snippet on a single line
        subtitle = subtitle.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (subtitle.length > 150) {
            subtitle = subtitle.substring(0, 150) + "...";
        }
    }

    return (
        <div className="group flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap rounded-xl border border-surface-border bg-surface p-2 sm:p-3 transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:bg-surface-light hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded bg-surface-light text-[10px] sm:text-xs font-semibold text-muted">
                {index + 1}
            </span>

            <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 \${color}`} />

            <div className="min-w-0 flex-1 w-full sm:w-auto order-first sm:order-none basis-full sm:basis-auto mb-2 sm:mb-0">
                <p className="text-sm font-medium text-heading truncate transition-colors group-hover:text-secondary-light">
                    {item.title}
                </p>
                {subtitle && (
                    <LatexText
                        text={subtitle}
                        as="p"
                        className="mt-0.5 text-xs text-muted truncate"
                    />
                )}
                {item.description && (
                    <LatexText
                        text={item.description}
                        as="p"
                        className="mt-0.5 text-xs text-muted/70 line-clamp-2"
                    />
                )}
            </div>

                {/* Actions container: Allow wrapping and shrinking on small screens */}
                <div className="flex flex-wrap shrink items-center justify-end gap-1.5 sm:gap-2 ml-auto mt-2 sm:mt-0 w-full sm:w-auto">
                    {item.type === "question" && item.question_id && questionStatus && (
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${
                    questionStatus.passed
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
                            title={
                                questionStatus.passed
                                    ? t("ACTIVITY_ITEM_QUESTION_CORRECT")
                                    : t("ACTIVITY_ITEM_QUESTION_INCORRECT")
                            }
                        >
                            {questionStatus.passed ? (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                            ) : (
                                <XCircle className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate max-w-[80px] sm:max-w-none">
                                {questionStatus.passed
                                    ? t("ACTIVITY_ITEM_QUESTION_CORRECT")
                                    : t("ACTIVITY_ITEM_QUESTION_INCORRECT")}
                            </span>
                        </span>
                    )}

                    {item.type === "question" && item.question_id && (
                        <Link
                            href={`/${locale}/dashboard/questions/${item.question_id}/answer?activity=${activityId}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2 py-1 sm:px-2.5 text-[10px] sm:text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors"
                        >
                            <PenLine className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                            <span className="truncate max-w-[80px] sm:max-w-none">{t("ACTIVITY_ITEM_ANSWER")}</span>
                        </Link>
                    )}

                    {hasOpenAction && (
                        <button
                            onClick={handleOpen}
                            disabled={opening}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2 py-1 sm:px-2.5 text-[10px] sm:text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors disabled:opacity-50"
                        >
                            {opening ? (
                                <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin shrink-0" />
                            ) : (
                                <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                            )}
                            <span className="truncate max-w-[80px] sm:max-w-none">{t("ACTIVITY_ITEM_OPEN")}</span>
                        </button>
                    )}

                    {hasLinkAction && (
                        <Link
                            href={`/${locale}/dashboard/exams/${item.simulated_exam_id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2 py-1 sm:px-2.5 text-[10px] sm:text-xs font-medium text-muted hover:text-heading hover:border-secondary/40 transition-colors"
                        >
                            <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                            <span className="truncate max-w-[80px] sm:max-w-none">{t("ACTIVITY_ITEM_OPEN")}</span>
                        </Link>
                    )}

                    {item.type === "question" && item.median_difficulty !== undefined && item.median_difficulty !== null && (
                        <div className="flex gap-1 flex-wrap justify-end w-full sm:w-auto mt-1 sm:mt-0">
                            {item.median_logic !== undefined && item.median_logic !== null && (
                                <span
                                    className={`group/logic relative inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-medium uppercase cursor-default ${item.median_logic >= 2.25 ? "bg-red-500/10 text-red-400" :
                                        item.median_logic >= 1.25 ? "bg-amber-500/10 text-amber-400" :
                                            "bg-green-500/10 text-green-400"
                                        }`}
                                >
                                    <Brain className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                    <span className="truncate">{item.median_logic >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : item.median_logic >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}</span>
                                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[9px] text-white opacity-0 transition-opacity group-hover/logic:opacity-100">{t("FEEDBACK_LOGIC")}</span>
                                </span>
                            )}
                            {item.median_labor !== undefined && item.median_labor !== null && (
                                <span
                                    className={`group/labor relative inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-medium uppercase cursor-default ${item.median_labor >= 2.25 ? "bg-red-500/10 text-red-400" :
                                        item.median_labor >= 1.25 ? "bg-amber-500/10 text-amber-400" :
                                            "bg-green-500/10 text-green-400"
                                        }`}
                                >
                                    <Cpu className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                    <span className="truncate">{item.median_labor >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : item.median_labor >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}</span>
                                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[9px] text-white opacity-0 transition-opacity group-hover/labor:opacity-100">{t("FEEDBACK_LABOR")}</span>
                                </span>
                            )}
                            {item.median_theory !== undefined && item.median_theory !== null && (
                                <span
                                    className={`group/theory relative inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-medium uppercase cursor-default ${item.median_theory >= 2.25 ? "bg-red-500/10 text-red-400" :
                                        item.median_theory >= 1.25 ? "bg-amber-500/10 text-amber-400" :
                                            "bg-green-500/10 text-green-400"
                                        }`}
                                >
                                    <BookOpen className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                    <span className="truncate">{item.median_theory >= 2.25 ? t("FEEDBACK_LEVEL_HIGH") : item.median_theory >= 1.25 ? t("FEEDBACK_LEVEL_MEDIUM") : t("FEEDBACK_LEVEL_LOW")}</span>
                                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[9px] text-white opacity-0 transition-opacity group-hover/theory:opacity-100">{t("FEEDBACK_THEORY")}</span>
                                </span>
                            )}
                        </div>
                    )}

                    <span className="inline-flex items-center rounded-full bg-surface-light px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-medium text-muted uppercase">
                        <span className="truncate">{t(`ACTIVITY_ITEM_TYPE_${item.type.toUpperCase()}`, { defaultValue: item.type })}</span>
                    </span>
                </div>
            </div>
    );
}
