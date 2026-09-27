/**
 * La caisse — les règles qui décident de ce qui est payé, mesuré et livré.
 * Sans base, sans réseau, sans Stripe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay, WATCHED_CADENCE_DAYS } from "@/inngest/functions/planificateur";
import { editionAgeDays } from "@/inngest/functions/livreur";
import { publicQueueWeeks, estimateEditionUsd } from "@/lib/plan-economics";
import { matchCategory } from "@/lib/index-lookup";
import { orderBucket } from "@/lib/spend-guard";
import { OFFERS, amountCents, FRESH_DAYS } from "@/lib/offers";
import type { IndexCategory } from "@/lib/index-catalog";

const cat = (key: string, o: Partial<IndexCategory> = {}): IndexCategory => ({
  key, slug: key, label: key, scope: key, audience: "", country: "FR", language: "fr", sector: null,
  status: "active", origin: "founder", cadenceDays: 30, requests: 0, priority: 0, lastMeasuredAt: null, ...o,
});
const now = new Date("2026-09-27T06:00:00Z");

test("Offres : les montants envoyés à Stripe viennent de offers.ts, en centimes", () => {
  assert.equal(amountCents("priority"), OFFERS.priority.priceEur * 100);
  assert.equal(amountCents("suivi"), OFFERS.suivi.priceEur * 100);
  assert.equal(OFFERS.agency.includedPriority, 10);
});

test("Mode test Stripe : une mesure commandée reste sous le plafond de l'Index", () => {
  const before = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  assert.equal(orderBucket(), "index");
  process.env.STRIPE_SECRET_KEY = "sk_live_x";
  assert.equal(orderBucket(), "paid");
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(orderBucket(), "index");
  if (before !== undefined) process.env.STRIPE_SECRET_KEY = before;
});

test("File publique : le délai affiché grandit avec la file, borné à « plus de trois mois »", () => {
  const first = publicQueueWeeks(0, 8);
  const tenth = publicQueueWeeks(9, 8);
  assert.ok(first >= 1);
  assert.ok(tenth > first);
  assert.equal(publicQueueWeeks(500, 8), 13);
  assert.equal(publicQueueWeeks(0, 0), 13);
  // Avec le plafond de 8 $, une édition de 10 questions coûte ~0,72 $ : ~2,5 par semaine.
  assert.ok(Math.abs(estimateEditionUsd(10) - 0.715) < 0.01);
});

test("Livreur : une édition de moins de trois jours est livrée telle quelle", () => {
  assert.ok(editionAgeDays("2026-09-25", now) <= FRESH_DAYS);
  assert.ok(editionAgeDays("2026-09-20", now) > FRESH_DAYS);
});

test("Suivi : une catégorie suivie est remesurée hors budget gratuit et hors quota", () => {
  const cats = [cat("fr:suivie", { cadenceDays: 60 }), cat("fr:libre")];
  const last = new Map([
    ["fr:suivie", "2026-08-20"], // 38 jours : due pour un suivi (30), pas pour sa cadence (60)
    ["fr:libre", "2026-08-20"],
  ]);
  const q = new Map([["fr:suivie", 10], ["fr:libre", 10]]);
  const plan = planDay(cats, last, q, 0, now, new Set(["fr:suivie"]));
  assert.deepEqual(plan.watched, ["fr:suivie"]);
  // Budget gratuit nul : la catégorie libre, due, est écartée ; la suivie passe quand même.
  assert.equal(plan.measure.length, 0);
  assert.ok(plan.skipped.some((s) => s.key === "fr:libre" && /budget/.test(s.reason)));
  assert.equal(WATCHED_CADENCE_DAYS, 30);
});

test("Suivi : une catégorie suivie mesurée il y a 10 jours n'est pas remesurée", () => {
  const plan = planDay([cat("fr:s")], new Map([["fr:s", "2026-09-17"]]), new Map([["fr:s", 10]]), 10, now, new Set(["fr:s"]));
  assert.equal(plan.watched.length, 0);
  assert.equal(plan.measure.length, 0);
});

test("Widget : la saisie libre retrouve la catégorie mesurée, dans le bon pays seulement", () => {
  const cats = [
    cat("fr:creme-solaire", { label: "Crème solaire", slug: "creme-solaire-fr" }),
    cat("fr:complements-fatigue", { label: "Compléments anti-fatigue", slug: "complements-fatigue-fr" }),
    cat("us:crm-software", { label: "CRM software", country: "US", slug: "crm-software-us" }),
  ];
  assert.equal(matchCategory("crème solaire", "FR", cats)?.key, "fr:creme-solaire");
  assert.equal(matchCategory("Creme Solaire bio", "FR", cats)?.key, "fr:creme-solaire");
  assert.equal(matchCategory("CRM software", "US", cats)?.key, "us:crm-software");
  assert.equal(matchCategory("CRM software", "FR", cats), null);
  assert.equal(matchCategory("matelas en latex", "FR", cats), null);
  assert.equal(matchCategory("", "FR", cats), null);
});
