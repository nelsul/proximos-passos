"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { getMe } from "@/lib/auth";

export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getMe()
      .then(() => router.replace("/dashboard"))
      .catch(() => setChecking(false));
  }, [router]);

  return checking;
}
