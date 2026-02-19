"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { updateUser, type UserResponse } from "@/lib/users";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";

interface EditUserModalProps {
  user: UserResponse;
  onClose: () => void;
  onUpdated: (user: UserResponse) => void;
}

export function EditUserModal({
  user,
  onClose,
  onUpdated,
}: EditUserModalProps) {
  const t = useTranslations();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const updated = await updateUser(user.id, {
        name,
        role,
        is_active: isActive,
      });
      onUpdated(updated);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("USER_EDIT_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <InputField
            label={t("USER_NAME_LABEL")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("USER_NAME_PLACEHOLDER")}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("USER_EMAIL_LABEL")}
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-lg border border-surface-border bg-surface-light px-4 py-2.5 text-muted outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("USER_ROLE_LABEL")}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-background px-4 py-2.5 text-body outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
            >
              <option value="regular">{t("USER_ROLE_REGULAR")}</option>
              <option value="admin">{t("USER_ROLE_ADMIN")}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-heading">
              {t("USER_STATUS_LABEL")}
            </label>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isActive ? "bg-green-500" : "bg-surface-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <p className="text-sm text-muted">
              {isActive ? t("USER_ACTIVE") : t("USER_INACTIVE")}
            </p>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("PROFILE_CANCEL")}
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {t("PROFILE_SAVE")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
