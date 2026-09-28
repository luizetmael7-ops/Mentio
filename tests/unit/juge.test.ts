/**
 * Le juge gratuit : ce qu'il accepte des modèles ouverts, et la chaîne qu'il suit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeExtraction, ExtractionSchema } from "@/lib/llm/judge";
import { freeModels } from "@/lib/llm/free-models";

const brand = { name: "Typology", position: 1, sentiment: "positive" };

test("Juge : la liste seule, ou un objet indexé, sont ramenés à la forme attendue", () => {
  assert.deepEqual(ExtractionSchema.parse(normalizeExtraction([brand])).brands, [brand]);
  assert.deepEqual(ExtractionSchema.parse(normalizeExtraction({ brands: { a: brand } })).brands, [brand]);
  assert.throws(() => ExtractionSchema.parse(normalizeExtraction({ brands: "Typology" })));
});

test("Juge : une réponse sans champ « brands » échoue — jamais « aucune marque » en silence", () => {
  // Régression du 27 septembre 2026 : {} et {"marques": [...]} devenaient une
  // liste vide, et le repli vers le modèle suivant ne se déclenchait plus.
  assert.throws(() => ExtractionSchema.parse(normalizeExtraction({})));
  assert.throws(() => ExtractionSchema.parse(normalizeExtraction({ marques: [brand] })));
  assert.throws(() => ExtractionSchema.parse(normalizeExtraction(null)));
});

test("Chaîne gratuite : jamais un modèle facturé, même par variable d'environnement", () => {
  const before = { list: process.env.OPENROUTER_FREE_MODELS, first: process.env.OPENROUTER_JUDGE_MODEL };
  process.env.OPENROUTER_FREE_MODELS = "a/b:free, openai/gpt-5, c/d:free";
  process.env.OPENROUTER_JUDGE_MODEL = "c/d:free";
  assert.deepEqual(freeModels(), ["c/d:free", "a/b:free"]);
  delete process.env.OPENROUTER_FREE_MODELS;
  delete process.env.OPENROUTER_JUDGE_MODEL;
  assert.ok(freeModels().length >= 1);
  assert.ok(freeModels().every((m) => m.endsWith(":free")));
  if (before.list !== undefined) process.env.OPENROUTER_FREE_MODELS = before.list;
  if (before.first !== undefined) process.env.OPENROUTER_JUDGE_MODEL = before.first;
});
