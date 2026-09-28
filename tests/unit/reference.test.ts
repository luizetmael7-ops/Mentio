/**
 * Le jeu de référence : le calcul de la note du juge, et l'intégrité des
 * annotations (une annotation fausse note faussement le juge).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregate, scoreItem, type ReferenceItem } from "@/lib/reference-eval";
import { sameBrand, isNonBrand } from "@/lib/llm/judge";

const doc = JSON.parse(readFileSync("tests/reference/annotations.json", "utf8")) as { items: ReferenceItem[] };

test("Note : un alias compte pour la même marque, un piège compte comme faux positif", () => {
  const item = {
    id: "x",
    expected: [{ name: "Arkopharma", aliases: ["Forcapil"] }, { name: "Nutri&Co" }],
    tolerated: ["Bailleul"],
  };
  const s = scoreItem(item, ["Forcapil", "Arkopharma", "Nutri & Co", "Bailleul", "ANSES"]);
  assert.equal(s.truePositives, 2);
  assert.deepEqual(s.falsePositives, ["ANSES"]);
  assert.deepEqual(s.falseNegatives, []);
});

test("Note : une réponse sans marque, rendue vide, est un succès", () => {
  const items = [{ id: "a", expected: [], tolerated: [], traps: ["NIH"], model: "m", prompt: "p", answer: "" }];
  const total = aggregate(items, [scoreItem(items[0], [])]);
  assert.equal(total.emptyCorrect, 1);
  assert.equal(total.precision, 1);
});

test("Annotations : 20 réponses réelles, identifiants uniques, texte présent", () => {
  assert.equal(doc.items.length, 20);
  assert.equal(new Set(doc.items.map((i) => i.id)).size, doc.items.length);
  for (const item of doc.items) {
    assert.ok(item.answer.length > 80, item.id);
    assert.ok(["chatgpt", "gemini"].includes(item.model), item.id);
  }
});

test("Annotations : aucune marque attendue n'est un piège, ni un nom exclu par le juge", () => {
  for (const item of doc.items) {
    for (const b of item.expected) {
      assert.ok(!item.traps.some((t) => sameBrand(t, b.name)), `${item.id} : ${b.name} est aussi un piège`);
      assert.ok(!isNonBrand(b.name), `${item.id} : ${b.name} est exclu par le juge`);
      // Chaque marque attendue apparaît vraiment dans le texte (nom ou alias).
      const names = [b.name, ...(b.aliases ?? [])];
      const flat = (t: string) => t.toLowerCase().replace(/[’`]/g, "'");
      const text = flat(item.answer);
      assert.ok(
        names.some((n) => text.includes(flat(n))),
        `${item.id} : « ${b.name} » introuvable dans la réponse`
      );
    }
  }
});

test("Noms de marques : une marque courte n'absorbe plus une autre", () => {
  assert.equal(sameBrand("RoC", "La Roche-Posay"), false);
  assert.equal(sameBrand("Cien", "Science & Nature"), false);
  assert.equal(sameBrand("Pai", "Laboratoires Pai Paris"), false);
  // Ce qui doit rester la même marque :
  assert.equal(sameBrand("Nutri&Co", "Nutri & Co"), true);
  assert.equal(sameBrand("NUXE", "Nuxe Paris"), true);
  assert.equal(sameBrand("Avène", "Avene"), true);
  assert.equal(sameBrand("Roche-Posay", "La Roche-Posay"), true);
  assert.equal(sameBrand("Lashilé", "Lashilé Beauty"), true);
});
