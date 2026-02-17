"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatexSnippet {
  /** Display label (may be plain text, a symbol, or short LaTeX-like notation) */
  label: string;
  /** The template to insert. Use | to mark where the cursor should go. */
  template: string;
  /** Tooltip / description */
  tooltip?: string;
  /** Category for grouping */
  category: Category;
}

type Category =
  | "structure"
  | "math"
  | "operators"
  | "comparison"
  | "greek"
  | "accents";

interface LatexToolbarProps {
  /** Ref to the <textarea> or <input> element this toolbar controls */
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** Called after inserting a snippet — receives the updated full value */
  onInsert: (newValue: string) => void;
  /** Compact mode hides category labels, useful for small inputs */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Snippet catalogue
// ---------------------------------------------------------------------------

const SNIPPETS: LatexSnippet[] = [
  // Structure
  {
    label: "$ $",
    template: "$|$",
    tooltip: "LATEX_TIP_INLINE_MATH",
    category: "structure",
  },
  {
    label: "$$ $$",
    template: "$$\n|\n$$",
    tooltip: "LATEX_TIP_BLOCK_MATH",
    category: "structure",
  },
  {
    label: "↵",
    template: "\\\\\n|",
    tooltip: "LATEX_TIP_LINE_BREAK",
    category: "structure",
  },
  {
    label: "bold",
    template: "\\textbf{|}",
    tooltip: "LATEX_TIP_BOLD",
    category: "structure",
  },
  {
    label: "italic",
    template: "\\textit{|}",
    tooltip: "LATEX_TIP_ITALIC",
    category: "structure",
  },

  // Math
  {
    label: "a/b",
    template: "\\frac{|}{b}",
    tooltip: "LATEX_TIP_FRACTION",
    category: "math",
  },
  {
    label: "x²",
    template: "^{|}",
    tooltip: "LATEX_TIP_SUPERSCRIPT",
    category: "math",
  },
  {
    label: "x₂",
    template: "_{|}",
    tooltip: "LATEX_TIP_SUBSCRIPT",
    category: "math",
  },
  {
    label: "√",
    template: "\\sqrt{|}",
    tooltip: "LATEX_TIP_SQRT",
    category: "math",
  },
  {
    label: "ⁿ√",
    template: "\\sqrt[n]{|}",
    tooltip: "LATEX_TIP_NTHROOT",
    category: "math",
  },
  {
    label: "log",
    template: "\\log_{|}",
    tooltip: "LATEX_TIP_LOG",
    category: "math",
  },
  {
    label: "Σ",
    template: "\\sum_{i=|}^{n}",
    tooltip: "LATEX_TIP_SUM",
    category: "math",
  },
  {
    label: "∫",
    template: "\\int_{|}^{}",
    tooltip: "LATEX_TIP_INTEGRAL",
    category: "math",
  },
  {
    label: "lim",
    template: "\\lim_{x \\to |}",
    tooltip: "LATEX_TIP_LIMIT",
    category: "math",
  },
  {
    label: "∞",
    template: "\\infty",
    tooltip: "LATEX_TIP_INFINITY",
    category: "math",
  },

  // Operators
  {
    label: "×",
    template: "\\times",
    tooltip: "LATEX_TIP_TIMES",
    category: "operators",
  },
  {
    label: "÷",
    template: "\\div",
    tooltip: "LATEX_TIP_DIV",
    category: "operators",
  },
  {
    label: "±",
    template: "\\pm",
    tooltip: "LATEX_TIP_PLUS_MINUS",
    category: "operators",
  },
  {
    label: "·",
    template: "\\cdot",
    tooltip: "LATEX_TIP_DOT",
    category: "operators",
  },

  // Comparison
  {
    label: "≠",
    template: "\\neq",
    tooltip: "LATEX_TIP_NOT_EQUAL",
    category: "comparison",
  },
  {
    label: "≤",
    template: "\\leq",
    tooltip: "LATEX_TIP_LEQ",
    category: "comparison",
  },
  {
    label: "≥",
    template: "\\geq",
    tooltip: "LATEX_TIP_GEQ",
    category: "comparison",
  },
  {
    label: "≈",
    template: "\\approx",
    tooltip: "LATEX_TIP_APPROX",
    category: "comparison",
  },

  // Greek
  {
    label: "α",
    template: "\\alpha",
    tooltip: "LATEX_TIP_ALPHA",
    category: "greek",
  },
  {
    label: "β",
    template: "\\beta",
    tooltip: "LATEX_TIP_BETA",
    category: "greek",
  },
  {
    label: "γ",
    template: "\\gamma",
    tooltip: "LATEX_TIP_GAMMA",
    category: "greek",
  },
  {
    label: "δ",
    template: "\\delta",
    tooltip: "LATEX_TIP_DELTA",
    category: "greek",
  },
  {
    label: "θ",
    template: "\\theta",
    tooltip: "LATEX_TIP_THETA",
    category: "greek",
  },
  {
    label: "λ",
    template: "\\lambda",
    tooltip: "LATEX_TIP_LAMBDA",
    category: "greek",
  },
  {
    label: "π",
    template: "\\pi",
    tooltip: "LATEX_TIP_PI",
    category: "greek",
  },
  {
    label: "σ",
    template: "\\sigma",
    tooltip: "LATEX_TIP_SIGMA",
    category: "greek",
  },
  {
    label: "Δ",
    template: "\\Delta",
    tooltip: "LATEX_TIP_DELTA_UPPER",
    category: "greek",
  },
  {
    label: "Ω",
    template: "\\Omega",
    tooltip: "LATEX_TIP_OMEGA",
    category: "greek",
  },
];

// Order of category sections
const CATEGORY_ORDER: Category[] = [
  "structure",
  "math",
  "operators",
  "comparison",
  "greek",
];

const CATEGORY_LABELS: Record<Category, string> = {
  structure: "LATEX_CAT_STRUCTURE",
  math: "LATEX_CAT_MATH",
  operators: "LATEX_CAT_OPERATORS",
  comparison: "LATEX_CAT_COMPARISON",
  greek: "LATEX_CAT_GREEK",
  accents: "LATEX_CAT_ACCENTS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the cursor position `pos` is inside $...$ or $$...$$ math mode.
 */
function isInsideMathMode(text: string, pos: number): boolean {
  // Count unescaped $ signs before position
  let inBlock = false; // inside $$...$$
  let inInline = false; // inside $...$
  let i = 0;
  while (i < pos) {
    if (text[i] === "$") {
      if (text[i + 1] === "$") {
        // $$ toggle
        inBlock = !inBlock;
        i += 2;
        continue;
      }
      if (!inBlock) {
        inInline = !inInline;
      }
    }
    i++;
  }
  return inBlock || inInline;
}

/** Categories whose templates are plain text (not math commands). */
const NON_MATH_CATEGORIES: Category[] = ["structure"];

/**
 * Inserts `template` at the cursor position of the target element.
 * The `|` character in the template marks where the cursor should land after insertion.
 * If text is selected, the selection is replaced (and used as `|` replacement).
 *
 * For math commands inserted outside of a $...$ context, the template is
 * automatically wrapped in $...$ so that KaTeX renders it.
 */
function insertSnippet(
  el: HTMLTextAreaElement | HTMLInputElement,
  template: string,
  category: Category,
): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const selectedText = el.value.slice(start, end);

  // Auto-wrap math commands in $...$ when cursor is outside math mode
  let effectiveTemplate = template;
  if (
    !NON_MATH_CATEGORIES.includes(category) &&
    !isInsideMathMode(el.value, start)
  ) {
    effectiveTemplate = `$${template}$`;
  }

  // Replace the first `|` with selected text (or leave cursor there)
  const cursorMarker = "|";
  const hasCursor = effectiveTemplate.includes(cursorMarker);
  const insertText = hasCursor
    ? effectiveTemplate.replace(cursorMarker, selectedText)
    : effectiveTemplate;

  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const newValue = before + insertText + after;

  // Calculate new cursor position
  const cursorOffset = hasCursor
    ? before.length +
      effectiveTemplate.indexOf(cursorMarker) +
      selectedText.length
    : before.length + insertText.length;

  // Set value and cursor position (must be done after React state updates)
  // We use a microtask to ensure React has set the value first
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(cursorOffset, cursorOffset);
  });

  return newValue;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LatexToolbar({
  inputRef,
  onInsert,
  compact = false,
}: LatexToolbarProps) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState(false);

  const handleClick = useCallback(
    (snippet: LatexSnippet) => {
      const el = inputRef.current;
      if (!el) return;
      const newValue = insertSnippet(el, snippet.template, snippet.category);
      onInsert(newValue);
    },
    [inputRef, onInsert],
  );

  // Show primary snippets (always visible) vs all (expanded)
  const primarySnippets = SNIPPETS.filter(
    (s) =>
      s.category === "structure" ||
      s.category === "math" ||
      ["×", "÷", "±", "≠", "≤", "≥", "π"].includes(s.label),
  );

  const visibleSnippets = expanded ? SNIPPETS : primarySnippets;

  // Group by category
  const grouped = new Map<Category, LatexSnippet[]>();
  for (const cat of CATEGORY_ORDER) {
    const items = visibleSnippets.filter((s) => s.category === cat);
    if (items.length > 0) grouped.set(cat, items);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-surface-border bg-surface px-2 py-1">
      {compact ? (
        // Flat row for compact mode
        <>
          {visibleSnippets.map((snippet, i) => (
            <SnippetButton
              key={i}
              snippet={snippet}
              onClick={handleClick}
              t={t}
            />
          ))}
        </>
      ) : (
        // Grouped layout
        <>
          {Array.from(grouped.entries()).map(([cat, items], gi) => (
            <div key={cat} className="flex items-center gap-0.5">
              {gi > 0 && <span className="mx-0.5 h-4 w-px bg-surface-border" />}
              {items.map((snippet, i) => (
                <SnippetButton
                  key={i}
                  snippet={snippet}
                  onClick={handleClick}
                  t={t}
                />
              ))}
            </div>
          ))}
        </>
      )}

      {/* Expand / collapse toggle */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors hover:bg-surface-light hover:text-heading"
        title={expanded ? t("LATEX_SHOW_LESS") : t("LATEX_SHOW_MORE")}
      >
        {expanded ? t("LATEX_SHOW_LESS") : t("LATEX_SHOW_MORE")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SnippetButton
// ---------------------------------------------------------------------------

function SnippetButton({
  snippet,
  onClick,
  t,
}: {
  snippet: LatexSnippet;
  onClick: (s: LatexSnippet) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tooltipText = snippet.tooltip
    ? t(snippet.tooltip as Parameters<typeof t>[0], {
        defaultValue: snippet.tooltip,
      })
    : snippet.label;

  return (
    <button
      type="button"
      onClick={() => onClick(snippet)}
      title={tooltipText}
      className="rounded px-1.5 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
    >
      {snippet.label}
    </button>
  );
}
