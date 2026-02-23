import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Loader2, ListChecks } from "lucide-react";
import { type ActivityItemResponse } from "@/lib/activities";
import { LatexText } from "@/components/ui/latex-text";
import { stripImageMarkers } from "@/components/questions/statement-renderer";
import { TYPE_ICONS, TYPE_COLORS } from "./item-row";

interface SortableItemProps {
    item: ActivityItemResponse;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    deleting: boolean;
    isAdmin: boolean;
    t: (key: string, values?: any) => string;
}

export function SortableItem({
    item,
    index,
    onEdit,
    onDelete,
    deleting,
    t,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const Icon = TYPE_ICONS[item.type] ?? ListChecks;
    const color = TYPE_COLORS[item.type] ?? "text-muted";

    let subtitle = item.content_subtitle;
    if (item.type === "question" && subtitle) {
        subtitle = stripImageMarkers(subtitle);
        // Strip newlines to keep the snippet on a single line
        subtitle = subtitle.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (subtitle.length > 150) {
            subtitle = subtitle.substring(0, 150) + "...";
        }
    }

    const innerContent = useMemo(() => {
        return (
            <>
                <button
                    {...attributes}
                    {...listeners}
                    className="shrink-0 cursor-grab touch-none text-muted hover:text-heading active:cursor-grabbing"
                >
                    <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded bg-surface-light text-[10px] sm:text-xs font-semibold text-muted">
                    {index + 1}
                </span>

                <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${color}`} />

                <div className="min-w-0 flex-1 w-full sm:w-auto order-first sm:order-none basis-full sm:basis-auto mt-2 sm:mt-0 mb-2 sm:mb-0 ml-1 sm:ml-0">
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

                <span className="shrink-0 ml-auto sm:ml-0 rounded-full bg-surface-light px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-medium text-muted uppercase">
                    {t(`ACTIVITY_ITEM_TYPE_${item.type.toUpperCase()}`, { defaultValue: item.type })}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        onClick={onEdit}
                        className="rounded-lg p-1.5 text-muted hover:text-heading hover:bg-surface-light transition-colors"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={deleting}
                        className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-600/10 transition-colors disabled:opacity-50"
                    >
                        {deleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </>
        );
    }, [item, index, isDragging, deleting, t, Icon, color, subtitle, attributes, listeners, onEdit, onDelete]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 rounded-xl border border-surface-border bg-surface p-2 sm:p-3 transition-colors duration-200 hover:border-secondary/50 hover:bg-surface-light hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${isDragging ? "z-50 shadow-2xl ring-2 ring-primary" : ""
                }`}
        >
            {innerContent}
        </div>
    );
}
