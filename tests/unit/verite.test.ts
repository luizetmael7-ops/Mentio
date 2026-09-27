/**
 * La vérité des chiffres — les règles qui ont manqué en septembre 2026.
 * Lancer : npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEdition } from "@/lib/edition-audit";
import { brandDomainHints, domainMatchesBrand, classifySource } from "@/lib/source-types";
import { countryByCode, isForbiddenCountry, COUNTRIES } from "@/lib/index-catalog";
import { withoutEmails } from "@/lib/founder";

test("contrôle d'instrument : une édition « Gemini seul » est écartée", () => {
  const audit = auditEdition({
    models: ["chatgpt", "gemini"],
    runs: 50,
    answers: Array.from({ length: 50 }, () => ({ model: "gemini" })),
  });
  assert.equal(audit.valid, false);
  assert.deepEqual(audit.answeredModels, ["gemini"]);
  assert.match(audit.issues[0], /chatgpt/);
});

test("contrôle d'instrument : une couverture partielle (< 80 %) est écartée", () => {
  const answers = [
    ...Array.from({ length: 50 }, () => ({ model: "gemini" })),
    ...Array.from({ length: 30 }, () => ({ model: "chatgpt" })),
  ];
  assert.equal(auditEdition({ models: ["chatgpt", "gemini"], runs: 80, answers }).valid, false);
});

test("contrôle d'instrument : une édition complète passe, un décompte SQL aussi", () => {
  const answers = [
    ...Array.from({ length: 50 }, () => ({ model: "gemini" })),
    ...Array.from({ length: 48 }, () => ({ model: "chatgpt" })),
  ];
  assert.equal(auditEdition({ models: ["chatgpt", "gemini"], runs: 100, answers }).valid, true);
  assert.equal(
    auditEdition({ models: ["chatgpt", "gemini"], runs: 100, answeredByModel: { chatgpt: 98, gemini: 98 } }).valid,
    true
  );
});

test("contrôle d'instrument : une édition ancienne sans détail est conservée", () => {
  assert.equal(auditEdition({ models: ["chatgpt", "gemini"], runs: 100 }).valid, true);
});

test("sites de marques : Nutri&Co n'est plus une source à conquérir", () => {
  const cases: Array<[string, string, boolean]> = [
    ["nutriandco.com", "Nutri&Co", true],
    ["laroche-posay.fr", "La Roche-Posay", true],
    ["laboratoires-biarritz.com", "Laboratoires de Biarritz", true],
    ["eau-thermale-avene.fr", "Avène", true],
    ["darwin-nutrition.fr", "Nutri&Co", false],
    ["jaimelesbonsplans.fr", "Aime", false],
  ];
  for (const [domain, brand, expected] of cases) {
    const got = brandDomainHints(brand).some((h) => domainMatchesBrand(domain, h));
    assert.equal(got, expected, `${domain} / ${brand}`);
  }
  assert.equal(classifySource("nutriandco.com", brandDomainHints("Nutri&Co")).actionable, false);
});

test("marchés fermés : DE, AT et CA n'existent pas pour l'Index", () => {
  for (const code of ["DE", "AT", "CA", "de"]) {
    assert.equal(isForbiddenCountry(code), true);
    assert.equal(countryByCode(code), null);
  }
  assert.ok(countryByCode("FR"));
  assert.ok(!COUNTRIES.some((c) => isForbiddenCountry(c.code)));
});

test("notification téléphone : aucune adresse n'y transite", () => {
  const out = withoutEmails("Lead — Typology — 12/100 (jane.doe+x@agence-exemple.fr)");
  assert.doesNotMatch(out, /@/);
  assert.match(out, /Typology/);
});
