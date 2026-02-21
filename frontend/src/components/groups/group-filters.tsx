"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

interface GroupFiltersProps {
  name: string;
  onNameChange: (v: string) => void;
  accessType: string;
  onAccessTypeChange: (v: string) => void;
  visibilityType?: string;
  onVisibilityTypeChange?: (v: string) => void;
  showVisibility?: boolean;
}

export function GroupFilters({
  name,
  onNameChange,
  accessType,
  onAccessTypeChange,
  visibilityType,
  onVisibilityTypeChange,
  showVisibility = false,
}: GroupFiltersProps) {
  const t = useTranslations();

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Name search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("FILTER_NAME_PLACEHOLDER")}
          className="w-full rounded-lg border border-surface-border bg-surface py-2.5 pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-secondary focus:outline-none transition-colors hover:border-secondary/50"
        />
      </div>

      {/* Access type select */}
      <select
        value={accessType}
        onChange={(e) => onAccessTypeChange(e.target.value)}
        className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-heading focus:border-secondary focus:outline-none transition-colors hover:border-secondary/50"
      >
        <option value="">{t("FILTER_ACCESS_ALL")}</option>
        <option value="open">{t("GROUP_ACCESS_OPEN")}</option>
        <option value="closed">{t("GROUP_ACCESS_CLOSED")}</option>
      </select>

      {/* Visibility type select (my-groups only) */}
      {showVisibility && onVisibilityTypeChange && (
        <select
          value={visibilityType ?? ""}
          onChange={(e) => onVisibilityTypeChange(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-heading focus:border-secondary focus:outline-none transition-colors hover:border-secondary/50"
        >
          <option value="">{t("FILTER_VISIBILITY_ALL")}</option>
          <option value="public">{t("GROUP_VISIBILITY_PUBLIC")}</option>
          <option value="private">{t("GROUP_VISIBILITY_PRIVATE")}</option>
        </select>
      )}
    </div>
  );
}
