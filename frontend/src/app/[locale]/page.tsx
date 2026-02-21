import {
  BookOpen,
  Users,
  ClipboardCheck,
  Link2,
  BarChart3,
  BrainCircuit,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ScrollLink } from "@/components/ui/scroll-link";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

interface Feature {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

const FEATURES: Feature[] = [
  {
    icon: BookOpen,
    titleKey: "FEATURE_QUESTIONS_TITLE",
    descKey: "FEATURE_QUESTIONS_DESC",
  },
  {
    icon: BrainCircuit,
    titleKey: "FEATURE_AI_TITLE",
    descKey: "FEATURE_AI_DESC",
  },
  {
    icon: Link2,
    titleKey: "FEATURE_CONTENT_TITLE",
    descKey: "FEATURE_CONTENT_DESC",
  },
  {
    icon: Users,
    titleKey: "FEATURE_GROUPS_TITLE",
    descKey: "FEATURE_GROUPS_DESC",
  },
  {
    icon: ClipboardCheck,
    titleKey: "FEATURE_ACTIVITIES_TITLE",
    descKey: "FEATURE_ACTIVITIES_DESC",
  },
  {
    icon: BarChart3,
    titleKey: "FEATURE_EXAMS_TITLE",
    descKey: "FEATURE_EXAMS_DESC",
  },
];

export default function Home() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-surface-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <BrandLogo
              variant="horizontal"
              size="md"
              priority
              className="hidden sm:block"
            />
            <BrandLogo
              variant="horizontal"
              size="md"
              priority
              className="sm:hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
            >
              {t("HEADER_LOGIN")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-secondary/5 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <BrandLogo
              variant="full"
              size="lg"
              priority
              className="mx-auto mb-8"
            />
            <p className="text-lg leading-relaxed text-body sm:text-xl">
              {t.rich("HERO_DESCRIPTION", {
                highlight_concursos: (chunks) => (
                  <span className="font-semibold text-secondary">{chunks}</span>
                ),
                highlight_vestibulares: (chunks) => (
                  <span className="font-semibold text-secondary">{chunks}</span>
                ),
              })}
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-secondary-dark hover:shadow-xl"
              >
                {t("HERO_CTA_PRIMARY")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <ScrollLink href="#features">
                {t("HERO_CTA_SECONDARY")}
              </ScrollLink>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("FEATURES_HEADING")}
            </h2>
            <p className="mt-4 text-lg text-muted">
              {t("FEATURES_SUBHEADING")}
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.titleKey}
                className="group rounded-2xl border border-surface-border bg-surface p-8 transition-all hover:border-secondary/40 hover:bg-surface-light"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-colors group-hover:bg-secondary group-hover:text-white">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-heading">
                  {t(feature.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {t(feature.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            {t("CTA_HEADING")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            {t("CTA_DESCRIPTION")}
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-secondary px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-secondary-dark hover:shadow-xl"
          >
            {t("CTA_BUTTON")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-background py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <BrandLogo variant="icon" size="md" />
          <p className="text-sm text-muted">
            {t("FOOTER_RIGHTS", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
