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
import { useTranslations, useLocale } from "next-intl";
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
  const locale = useLocale();
  const imgLocale = locale === "en" ? "en" : "pt";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-surface-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80">
            <BrandLogo
              variant="icon"
              size="md"
              priority
              className="hidden sm:block"
            />
            <BrandLogo
              variant="icon"
              size="sm"
              priority
              className="sm:hidden"
            />
            <div className="mt-1 hidden min-[420px]:block">
              <BrandLogo variant="title" size="md" priority />
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageSwitcher />
            <div className="h-6 w-px bg-surface-border hidden sm:block"></div>
           
            <Link
              href="/login"
              className=" inline-flex items-center justify-center rounded-lg bg-heading px-4 py-2 mr-2 text-sm font-semibold text-background transition-colors hover:bg-heading/90"
            >
               {t("HEADER_LOGIN")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        {/* Subtle Next.js style top glow */}
        <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-[100%] bg-secondary/10 opacity-50 blur-[100px]" />
        
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:pt-40 lg:pb-32">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-heading sm:text-6xl lg:text-7xl mb-6">
              O seu caminho para a{" "}
              <span className="bg-gradient-to-r from-secondary-light via-secondary to-secondary-dark bg-clip-text text-transparent drop-shadow-sm">
                aprovação
              </span>
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              {t.rich("HERO_DESCRIPTION", {
                highlight_concursos: (chunks) => (
                  <span className="font-semibold text-body">{chunks}</span>
                ),
                highlight_vestibulares: (chunks) => (
                  <span className="font-semibold text-body">{chunks}</span>
                ),
              })}
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-heading px-8 py-3 text-base font-semibold tracking-wide uppercase text-background shadow-[0_2px_12px_rgba(207,161,86,0.15)] transition-all duration-200 hover:scale-[1.02] hover:bg-heading/90"
              >
                {t("HERO_CTA_PRIMARY")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <ScrollLink href="#features">
                {t("HERO_CTA_SECONDARY")}
              </ScrollLink>
            </div>
            
            {/* App Showcase */}
            <div className="relative mt-20 sm:mt-24 lg:mt-32 w-full animate-fade-in-up">
              <div className="rounded-2xl border border-surface-border bg-surface/50 p-2 shadow-[0_0_80px_rgba(207,161,86,0.1)] backdrop-blur-sm sm:p-4">
                <div className="overflow-hidden rounded-xl bg-background/50 ring-1 ring-surface-border/50">
                  <img
                    src={`https://proximos-passos.nelsul.dev/app_example_${imgLocale}.webp`}
                    alt="Proximos Passos App Preview"
                    className="w-full object-cover rounded-xl"
                  />
                </div>
              </div>
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
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-secondary-dark group-hover:via-secondary group-hover:to-secondary-light group-hover:text-white group-hover:shadow-[0_2px_12px_rgba(207,161,86,0.3)]">
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
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-secondary-dark via-secondary to-secondary-light px-8 py-3 text-base font-semibold tracking-wide uppercase text-white shadow-[0_2px_12px_rgba(207,161,86,0.3)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(207,161,86,0.5)] hover:brightness-110"
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
