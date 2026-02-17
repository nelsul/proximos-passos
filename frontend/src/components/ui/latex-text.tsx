"use client";

import { useMemo } from "react";
import katex from "katex";

interface LatexTextProps {
  text: string;
  className?: string;
  as?: "span" | "p" | "div";
}

/**
 * Renders text that may contain LaTeX math expressions.
 * Inline math: $...$ or \(...\)
 * Block math: $$...$$ or \[...\]
 */
export function LatexText({
  text,
  className,
  as: Tag = "span",
}: LatexTextProps) {
  const html = useMemo(() => renderLatex(text), [text]);
  return (
    <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function renderLatex(input: string): string {
  if (!input) return "";

  // We use markers to protect KaTeX output from further processing.
  const protected_: string[] = [];
  function protect(html: string): string {
    const idx = protected_.length;
    protected_.push(html);
    return `\x00K${idx}\x00`;
  }

  let result = input;

  // 1. Block math: $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, expr: string) => {
    try {
      return protect(
        katex.renderToString(expr.trim(), {
          displayMode: true,
          throwOnError: false,
          trust: true,
        }),
      );
    } catch {
      return protect(`<span class="text-error">[Math Error]</span>`);
    }
  });

  // 2. Inline math: $...$  (but not $$ which we already processed)
  result = result.replace(
    /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g,
    (_match, expr: string) => {
      try {
        return protect(
          katex.renderToString(expr.trim(), {
            displayMode: false,
            throwOnError: false,
            trust: true,
          }),
        );
      } catch {
        return protect(`<span class="text-error">[Math Error]</span>`);
      }
    },
  );

  // 3. Escape remaining HTML characters so raw text is safe
  result = result
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 4. Text-mode LaTeX commands (outside math)
  result = result.replace(/\\textbf\{([^}]*)}/g, "<strong>$1</strong>");
  result = result.replace(/\\textit\{([^}]*)}/g, "<em>$1</em>");

  // 5. Line breaks: explicit \\ and newlines
  result = result.replace(/\\\\/g, "<br>");
  result = result.replace(/\n/g, "<br>");

  // 6. Restore protected KaTeX blocks
  for (let i = 0; i < protected_.length; i++) {
    result = result.replace(`\x00K${i}\x00`, protected_[i]);
  }

  return result;
}
