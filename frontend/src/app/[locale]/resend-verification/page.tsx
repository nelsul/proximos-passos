"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { requestVerification } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { BrandLogo } from "@/components/ui/brand-logo";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

export default function ResendVerificationPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestVerification(email);
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
              {t("RESEND_SUCCESS_TITLE")}
            </h1>
            <p className="text-muted">{t("RESEND_SUCCESS_DESCRIPTION")}</p>
          </div>

          <ButtonLink href="/login">{t("RESEND_LOGIN_LINK")}</ButtonLink>
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
          <p className="text-center text-muted">{t("RESEND_SUBTITLE")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <InputField
            label={t("RESEND_EMAIL_LABEL")}
            name="email"
            type="email"
            placeholder={t("RESEND_EMAIL_PLACEHOLDER")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />

          <Button type="submit" loading={loading} className="mt-2">
            {t("RESEND_SUBMIT")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted">
          <Link href="/login" className="text-secondary hover:underline">
            {t("RESEND_LOGIN_LINK")}
          </Link>
        </p>
      </div>
    </div>
  );
}
