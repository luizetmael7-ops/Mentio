import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout — sur les données de démonstration (MENTIO_FIXTURES=1) :
 * aucun appel payant, aucune écriture en base, jamais la production.
 *
 * Prérequis : `next build` avec les mêmes variables (le workflow le fait).
 * En local dans un conteneur sans navigateur Playwright : PW_CHROMIUM=/chemin/chrome.
 */
const PORT = 3200;
const env = {
  MENTIO_FIXTURES: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "demo",
  SUPABASE_SERVICE_ROLE_KEY: "demo",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-380", use: { ...devices["Desktop Chrome"], viewport: { width: 380, height: 800 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env,
  },
});
