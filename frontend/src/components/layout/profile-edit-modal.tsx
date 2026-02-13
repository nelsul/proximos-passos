"use client";

import { useState, useRef, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { X, Camera, Trash2 } from "lucide-react";
import {
  updateMe,
  uploadAvatar,
  deleteAvatar,
  type UserResponse,
} from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ProfileEditModalProps {
  user: UserResponse;
  onClose: () => void;
  onUpdated: (user: UserResponse) => void;
}

export function ProfileEditModal({
  user,
  onClose,
  onUpdated,
}: ProfileEditModalProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar_url ?? null,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let updatedUser: UserResponse = user;

      if (name !== user.name) {
        updatedUser = await updateMe(name);
      }

      if (avatarFile) {
        updatedUser = await uploadAvatar(avatarFile);
      } else if (removeAvatar && user.avatar_url) {
        updatedUser = await deleteAvatar();
      }

      onUpdated(updatedUser);
      onClose();
      toast(t("PROFILE_SUCCESS"));
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

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">
            {t("PROFILE_TITLE")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-light hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Avatar */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={name}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-white">
                  {initials}
                </span>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-surface-light p-1.5 text-heading transition-colors hover:bg-primary-light"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {(avatarPreview || user.avatar_url) && !removeAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="flex items-center gap-1.5 text-xs text-error transition-colors hover:text-error/80"
              >
                <Trash2 className="h-3 w-3" />
                {t("PROFILE_REMOVE_AVATAR")}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <InputField
            label={t("PROFILE_NAME_LABEL")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("PROFILE_NAME_PLACEHOLDER")}
            required
          />

          {/* Email (read-only) */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-heading">
              {t("PROFILE_EMAIL_LABEL")}
            </label>
            <p className="rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-muted">
              {user.email}
            </p>
          </div>

          {error && <p className="mt-4 text-sm text-error">{error}</p>}

          <div className="mt-6 flex gap-3">
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
