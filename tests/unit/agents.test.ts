/**
 * Les règles des agents — Planificateur et Vigie — sans base ni réseau.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay } from "@/inngest/functions/planificateur";
import { assessHealth, type HealthInputs } from "@/lib/health";
import { estimateEditionUsd } from "@/lib/plan-economics";
import type { IndexCategory } from "@/lib/index-catalog";

const cat = (key: string, o: Partial<IndexCategory> = {}): IndexCategory => ({
  key, slug: key, label: key, scope: key, audience: "", country: "FR", language: "fr", sector: null,
  status: "active", origin: "founder", cadenceDays: 30, requests: 0, priority: 0, lastMeasuredAt: null, ...o,
});
const now = new Date("2026-09-27T06:00:00Z");

test("Planificateur : une catégorie sans questions part au Cartographe, jamais au Mesureur", () => {
  const plan = planDay([cat("fr:x", { status: "queued" })], new Map(), new Map(), 10, now);
  assert.deepEqual(plan.prepare, ["fr:x"]);
  assert.equal(plan.measure.length, 0);
});

test("Planificateur : jamais au-delà du budget du jour", () => {
  const cats = [cat("a", { priority: 1 }), cat("b", { priority: 1 })];
  const q = new Map([["a", 50], ["b", 50]]);
  const plan = planDay(cats, new Map(), q, estimateEditionUsd(50) + 0.01, now);
  assert.equal(plan.measure.length, 1);
  assert.ok(plan.skipped.some((s) => /budget/.test(s.reason)));
});

test("Planificateur : une catégorie mesurée il y a 10 jours n'est pas remesurée", () => {
  const plan = planDay([cat("a")], new Map([["a", "2026-09-17"]]), new Map([["a", 10]]), 10, now);
  assert.equal(plan.measure.length, 0);
});

test("Planificateur : les plus demandées passent d'abord", () => {
  const cats = [cat("peu", { requests: 1 }), cat("beaucoup", { requests: 9 })];
  const q = new Map([["peu", 10], ["beaucoup", 10]]);
  const plan = planDay(cats, new Map(), q, estimateEditionUsd(10) + 0.01, now);
  assert.equal(plan.measure[0].key, "beaucoup");
});

const base: HealthInputs = {
  now: now.getTime(),
  configuredModels: { chatgpt: true, gemini: true },
  rejected: [],
  categories: [],
  lastPublished: {},
  monthUsd: 1,
  capUsd: 8,
  waiting: [],
};

test("Vigie : rien de cassé, rien à dire", () => {
  assert.equal(assessHealth(base).issues.length, 0);
});

test("Vigie : un lead sans réponse depuis 3 jours est critique (le cas Koïno)", () => {
  const report = assessHealth({
    ...base,
    waiting: [{ kind: "lead", who: "x@y.fr", what: "Koïno — agence", at: "2026-09-05T10:00:00Z" }],
  });
  assert.equal(report.issues[0].severity, "critique");
  assert.match(report.issues[0].title, /attendent une réponse/);
});

test("Vigie : moteur sans clé, compteur illisible et édition écartée sont signalés", () => {
  const report = assessHealth({
    ...base,
    configuredModels: { chatgpt: false, gemini: true },
    monthUsd: NaN,
    rejected: [{ date: "2026-09-20", vertical: "beaute_complements", issues: ["chatgpt muet"] }],
  });
  const titles = report.issues.map((i) => i.title).join(" | ");
  assert.match(titles, /ChatGPT n'a pas de clé/);
  assert.match(titles, /illisible/);
  assert.match(titles, /écartée/);
  assert.equal(report.spend.monthUsd, null);
});

test("Vigie : une catégorie active en retard de plus de 10 jours est signalée", () => {
  const report = assessHealth({
    ...base,
    categories: [{ key: "a", label: "Crème solaire", status: "active", cadenceDays: 30 }],
    lastPublished: { a: "2026-08-01" },
  });
  assert.match(report.issues[0].title, /Crème solaire/);
});
