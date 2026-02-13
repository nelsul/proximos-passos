"use client";

import { useTranslations } from "next-intl";
import { Users, Lock, Globe, DoorOpen, DoorClosed } from "lucide-react";
import type { GroupResponse } from "@/lib/groups";

interface GroupCardProps {
  group: GroupResponse;
}

export function GroupCard({ group }: GroupCardProps) {
  const t = useTranslations();

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4 transition-colors hover:border-secondary/40">
      <div className="flex items-start gap-4">
        {group.thumbnail_url ? (
          <img
            src={group.thumbnail_url}
            alt={group.name}
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-secondary/15">
            <Users className="h-7 w-7 text-secondary" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-heading">
            {group.name}
          </h3>
          {group.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {group.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-light px-2.5 py-0.5 text-xs font-medium text-body">
              {group.visibility_type === "public" ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {group.visibility_type === "public"
                ? t("GROUP_VISIBILITY_PUBLIC")
                : t("GROUP_VISIBILITY_PRIVATE")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-light px-2.5 py-0.5 text-xs font-medium text-body">
              {group.access_type === "open" ? (
                <DoorOpen className="h-3 w-3" />
              ) : (
                <DoorClosed className="h-3 w-3" />
              )}
              {group.access_type === "open"
                ? t("GROUP_ACCESS_OPEN")
                : t("GROUP_ACCESS_CLOSED")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
