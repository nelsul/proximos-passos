"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface InviteGroupModalProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

export function InviteGroupModal({
  groupId,
  groupName,
  onClose,
}: InviteGroupModalProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/dashboard/groups/${groupId}/join`
      : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = joinUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-heading">
            {t("GROUP_INVITE_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">
          {t("GROUP_INVITE_DESCRIPTION", { name: groupName })}
        </p>

        {/* QR Code */}
        <div className="mb-5 flex justify-center">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG
              value={joinUrl}
              size={180}
              level="M"
              bgColor="#ffffff"
              fgColor="#0a1a1a"
            />
          </div>
        </div>

        {/* Link + Copy */}
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface p-2">
          <input
            type="text"
            readOnly
            value={joinUrl}
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-muted outline-none"
          />
          <button
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-secondary-dark"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                {t("GROUP_INVITE_COPIED")}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {t("GROUP_INVITE_COPY")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
