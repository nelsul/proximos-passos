import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function FilterTooltip() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <div 
      className="group relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(!open)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-heading focus:outline-none focus:ring-2 focus:ring-secondary/50"
        aria-label={t("FILTER_TOPIC_TOOLTIP")}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Tooltip Popup */}
      <div 
        className={`absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-surface-border bg-surface p-2.5 text-center text-xs text-body shadow-xl transition-all duration-200 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {t("FILTER_TOPIC_TOOLTIP")}
        {/* Arrow pointer */}
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-surface-border bg-surface"></div>
      </div>
    </div>
  );
}
