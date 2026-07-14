"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/** Init PostHog côté navigateur (pageviews automatiques, cloud EU). */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      defaults: "2025-05-24",
      capture_exceptions: true,
    });
  }, []);

  return <>{children}</>;
}
