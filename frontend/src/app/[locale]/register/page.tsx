"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { register } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { BrandLogo } from "@/components/ui/brand-logo";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useRedirectIfAuthenticated } from "@/hooks/use-redirect-if-authenticated";

export default function RegisterPage() {
  const t = useTranslations();
  const checking = useRedirectIfAuthenticated();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(name, email, password);
      setSuccess(true);
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

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <BrandLogo variant="full" size="lg" priority />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-white">
              {t("REGISTER_SUCCESS_TITLE")}
            </h1>
            <p className="text-muted">{t("REGISTER_SUCCESS_DESCRIPTION")}</p>
          </div>

          <ButtonLink href="/login">
            {t("VERIFY_EMAIL_LOGIN_BUTTON")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-6">
          <BrandLogo variant="full" size="lg" priority />
          <p className="text-center text-muted">{t("REGISTER_SUBTITLE")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <InputField
            label={t("REGISTER_NAME_LABEL")}
            name="name"
            type="text"
            placeholder={t("REGISTER_NAME_PLACEHOLDER")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
          />

          <InputField
            label={t("REGISTER_EMAIL_LABEL")}
            name="email"
            type="email"
            placeholder={t("REGISTER_EMAIL_PLACEHOLDER")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <InputField
            label={t("REGISTER_PASSWORD_LABEL")}
            name="password"
            type="password"
            placeholder={t("REGISTER_PASSWORD_PLACEHOLDER")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} className="mt-2">
            {t("REGISTER_SUBMIT")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted">
          <Link href="/login" className="text-secondary hover:underline">
            {t("REGISTER_LOGIN_LINK")}
          </Link>
        </p>
      </div>
    </div>
  );
}
