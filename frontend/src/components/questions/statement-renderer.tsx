"use client";

import type { QuestionImageResponse } from "@/lib/questions";
import { LatexText } from "@/components/ui/latex-text";

interface StatementRendererProps {
  statement: string;
  images: QuestionImageResponse[];
  className?: string;
  imageClassName?: string;
}

type Segment =
  | { type: "text"; content: string }
  | { type: "image"; url: string; filename: string };

/**
 * Renders a question statement that may contain inline image markers ({{img:N}})
 * and LaTeX math expressions ($...$, $$...$$).
 */
export function StatementRenderer({
  statement,
  images,
  className,
  imageClassName,
}: StatementRendererProps) {
  const segments = parseStatementSegments(statement, images);

  // If there are no image markers, also append any unlinked images at the end
  const hasMarkers = /\{\{img:\d+\}\}/.test(statement);
  const unreferencedImages = hasMarkers ? [] : images;

  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <LatexText
            key={i}
            text={seg.content}
            as="div"
            className="leading-relaxed"
          />
        ) : (
          <img
            key={i}
            src={seg.url}
            alt={seg.filename}
            className={
              imageClassName ??
              "my-4 max-w-full rounded-lg border border-gray-200 object-contain"
            }
          />
        ),
      )}
      {unreferencedImages.map((img) => (
        <img
          key={img.id}
          src={img.url}
          alt={img.filename}
          className={
            imageClassName ??
            "my-4 max-w-full rounded-lg border border-gray-200 object-contain"
          }
        />
      ))}
    </div>
  );
}

function parseStatementSegments(
  statement: string,
  images: QuestionImageResponse[],
): Segment[] {
  const segments: Segment[] = [];
  const regex = /\{\{img:(\d+)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(statement)) !== null) {
    const textBefore = statement.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      segments.push({ type: "text", content: textBefore });
    }

    const imgIndex = parseInt(match[1], 10);
    const image = images[imgIndex];
    if (image) {
      segments.push({
        type: "image",
        url: image.url,
        filename: image.filename,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = statement.slice(lastIndex);
  if (remaining.trim()) {
    segments.push({ type: "text", content: remaining });
  }

  return segments;
}

/** Strip {{img:N}} markers for plain-text display. */
export function stripImageMarkers(statement: string): string {
  return statement
    .replace(/\{\{img:\d+\}\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
