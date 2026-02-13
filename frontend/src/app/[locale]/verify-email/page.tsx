"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { verifyEmail } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ButtonLink } from "@/components/ui/button-link";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error" | "no-token";

export default function VerifyEmailPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(token ? "loading" : "no-token");
  const [errorMessage, setErrorMessage] = useState("");

  const verify = useCallback(
    async (verificationToken: string) => {
      try {
        await verifyEmail(verificationToken);
        setStatus("success");
      } catch (err) {
        setStatus("error");
        if (err instanceof ApiRequestError) {
          if (err.code === "EMAIL_ALREADY_VERIFIED") {
            setStatus("success");
            return;
          }
          setErrorMessage(
            t(`ERROR_${err.code}` as Parameters<typeof t>[0], {
              defaultValue: err.message,
            }),
          );
        } else {
          setErrorMessage(t("ERROR_INTERNAL_ERROR"));
        }
      }
    },
    [t],
  );

  useEffect(() => {
    if (token) {
      verify(token);
    }
  }, [token, verify]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md space-y-8 text-center">
        <BrandLogo variant="full" size="md" priority className="mx-auto" />

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-secondary" />
            <p className="text-lg text-muted">{t("VERIFY_EMAIL_LOADING")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
            <h1 className="text-2xl font-bold text-heading">
              {t("VERIFY_EMAIL_SUCCESS_TITLE")}
            </h1>
            <p className="text-muted">
              {t("VERIFY_EMAIL_SUCCESS_DESCRIPTION")}
            </p>
            <ButtonLink href="/login" className="mx-auto w-fit">
              {t("VERIFY_EMAIL_LOGIN_BUTTON")}
            </ButtonLink>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="mx-auto h-16 w-16 text-error" />
            <h1 className="text-2xl font-bold text-heading">
              {t("VERIFY_EMAIL_ERROR_TITLE")}
            </h1>
            <p className="text-muted">{errorMessage}</p>
            <ButtonLink
              href="/login"
              variant="outline"
              className="mx-auto w-fit"
            >
              {t("VERIFY_EMAIL_LOGIN_BUTTON")}
            </ButtonLink>
          </div>
        )}

        {status === "no-token" && (
          <div className="space-y-4">
            <XCircle className="mx-auto h-16 w-16 text-warning" />
            <h1 className="text-2xl font-bold text-heading">
              {t("VERIFY_EMAIL_NO_TOKEN_TITLE")}
            </h1>
            <p className="text-muted">
              {t("VERIFY_EMAIL_NO_TOKEN_DESCRIPTION")}
            </p>
            <ButtonLink
              href="/login"
              variant="outline"
              className="mx-auto w-fit"
            >
              {t("VERIFY_EMAIL_LOGIN_BUTTON")}
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
