import { PostHog } from "posthog-node";

/**
 * Capture d'événements côté serveur (actions, jobs, webhooks).
 * flushAt: 1 → chaque événement part immédiatement (compatible serverless).
 */
let _client: PostHog | null = null;
function client(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

export async function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const posthog = client();
  if (!posthog) return;
  try {
    posthog.capture({ event, distinctId, properties });
    await posthog.flush();
  } catch {
    // l'analytics ne doit jamais casser le produit
  }
}
