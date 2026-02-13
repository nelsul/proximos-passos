"use client";

import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { routing, useRouter, usePathname } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  "pt-BR": "PT",
  en: "EN",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = () => {
    const nextLocale =
      locale === routing.locales[0] ? routing.locales[1] : routing.locales[0];

    router.replace(pathname, { locale: nextLocale });
  };

  const nextLocale =
    locale === routing.locales[0] ? routing.locales[1] : routing.locales[0];

  return (
    <button
      onClick={switchLocale}
      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-heading"
      aria-label={`Switch to ${LOCALE_LABELS[nextLocale]}`}
    >
      <Languages className="h-4 w-4" />
      {LOCALE_LABELS[nextLocale]}
    </button>
  );
}
