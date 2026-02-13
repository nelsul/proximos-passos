"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { login } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { BrandLogo } from "@/components/ui/brand-logo";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useRedirectIfAuthenticated } from "@/hooks/use-redirect-if-authenticated";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const checking = useRedirectIfAuthenticated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
            defaultValue: err.message,
          }),
        );
      } else {
        setError(t("ERROR_INTERNAL_ERROR"));
      }
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-6">
          <BrandLogo variant="full" size="lg" priority />
          <p className="text-center text-muted">{t("LOGIN_SUBTITLE")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <InputField
            label={t("LOGIN_EMAIL_LABEL")}
            name="email"
            type="email"
            placeholder={t("LOGIN_EMAIL_PLACEHOLDER")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />

          <InputField
            label={t("LOGIN_PASSWORD_LABEL")}
            name="password"
            type="password"
            placeholder={t("LOGIN_PASSWORD_PLACEHOLDER")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} className="mt-2">
            {t("LOGIN_SUBMIT")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted">
          <Link href="/register" className="text-secondary hover:underline">
            {t("LOGIN_REGISTER_LINK")}
          </Link>
        </p>

        <p className="text-center text-sm text-muted">
          <Link
            href="/resend-verification"
            className="text-secondary hover:underline"
          >
            {t("LOGIN_RESEND_LINK")}
          </Link>
        </p>
      </div>
    </div>
  );
}
