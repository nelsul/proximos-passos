"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface CountdownTimerProps {
  targetDate: string;
  isPast?: boolean;
}

export function CountdownTimer({ targetDate, isPast = false }: CountdownTimerProps) {
  const t = useTranslations();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Update every minute to keep timer current
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const targetTime = new Date(targetDate).getTime();
  const diff = targetTime - now;
  const isOverdue = diff < 0;

  const absoluteDiff = Math.abs(diff);

  const days = Math.floor(absoluteDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absoluteDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absoluteDiff % (1000 * 60 * 60)) / (1000 * 60));

  let timeString = "";

  if (days > 0) {
    timeString = t("TIME_DAYS", { count: days });
    if (hours > 0) {
      timeString += ` ${t("TIME_HOURS", { count: hours })}`;
    }
  } else if (hours > 0) {
    timeString = t("TIME_HOURS", { count: hours });
    if (minutes > 0) {
      timeString += ` ${t("TIME_MINUTES", { count: minutes })}`;
    }
  } else if (minutes > 0) {
    timeString = t("TIME_MINUTES", { count: minutes });
  } else {
    timeString = t("TIME_MINUTES", { count: 0 }); // Just for fallback
  }

  // If it's a past activity, it ended.
  if (isPast) {
    return <span>{timeString}</span>; // We just return the elapsed time or just a static date later
  }

  if (isOverdue) {
    return <span>{t("ACTIVITY_OVERDUE", { time: timeString })}</span>;
  }

  if (days === 0 && hours === 0 && minutes === 0) {
    return <span>{t("ACTIVITY_DUE_TODAY")}</span>;
  }

  return <span>{t("ACTIVITY_DUE_IN", { time: timeString })}</span>;
}
