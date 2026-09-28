/**
 * « C'est ma marque » — la réponse promise, rédigée d'avance pour le fondateur.
 * Un gabarit : des chiffres de l'édition, aucun jugement (constitution §5).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { claimMailto, claimReplyDraft, emailOrigin } from "@/lib/claim-reply";
import { ordinal } from "@/lib/edition-format";
import { tierOf } from "@/lib/spectrum";
import { brandDomainHints, classifySource } from "@/lib/source-types";
import type { BrandReport } from "@/lib/report";

function report(over: Partial<BrandReport> = {}): BrandReport {
  return {
    name: "Soleil Test",
    slug: "soleil-test",
    score: 34,
    tier: tierOf(34),
    rank: 3,
    vertical: "fr:creme-solaire",
    totalBrands: 12,
    citations: 6.6,
    runs: 20,
    firstPlaces: 1,
    editionDate: "2026-09-01",
    nextMeasure: "2026-10-01",
    models: ["chatgpt", "gemini"],
    scoreDelta: null,
    perModel: [],
    rivals: [
      { name: "Avène", slug: "avene", citations: 14.2, firstPlaces: 5 },
      { name: "Bioderma", slug: "bioderma", citations: 1, firstPlaces: 0 },
    ],
    lostQuestions: [
      { prompt: "Quelle crème solaire pour un enfant ?", model: "chatgpt", winner: "Avène" },
      { prompt: "Crème solaire bio efficace ?", model: "gemini", winner: "Bioderma" },
    ],
    sources: [
      { domain: "avene.fr", count: 6, rivalWeight: 6, type: classifySource("avene.fr", brandDomainHints("Avène")) },
      { domain: "quechoisir.org", count: 4, rivalWeight: 3, type: classifySource("quechoisir.org") },
    ],
    actions: [],
    ...over,
  };
}

test("le brouillon dit les chiffres de l'édition, et rien d'autre", () => {
  const { subject, body } = claimReplyDraft(report(), "https://www.mentio.fr/rapport/soleil-test?jeton=x");
  assert.equal(subject, "Soleil Test dans les réponses de ChatGPT et Gemini — le détail");
  assert.match(body, /1er septembre 2026 : Soleil Test apparaît dans 7 réponses sur 20/);
  assert.match(body, /Score Mentio 34\/100, palier Citée, 3e sur 12 marques/);
  assert.match(body, /« Quelle crème solaire pour un enfant \? » — ChatGPT cite Avène/);
  // Les citations s'affichent arrondies, et au singulier quand il le faut.
  assert.match(body, /Avène \(14 réponses\), Bioderma \(1 réponse\)/);
  // Le site d'un concurrent n'est pas une cible.
  assert.match(body, /où Soleil Test peut entrer : quechoisir\.org\./);
  assert.doesNotMatch(body, /avene\.fr/);
  assert.match(body, /rapport\/soleil-test\?jeton=x/);
  assert.match(body, /19 € par mois, sans engagement/);
  assert.match(body, /demander une correction/);
  // §5 : aucun jugement de valeur sur une marque.
  assert.doesNotMatch(body, /mauvais|en retard|faible|décevant|excellent|bravo/i);
});

test("une marque absente : le constat, sans rang inventé", () => {
  const { body } = claimReplyDraft(
    report({ rank: null, score: 0, tier: tierOf(0), citations: 0 }),
    "https://www.mentio.fr/rapport/soleil-test"
  );
  assert.match(body, /aucune des 20 réponses de ChatGPT et Gemini ne cite Soleil Test\. 12 marques le sont\./);
  assert.doesNotMatch(body, /Score Mentio|null/);
});

test("le leader est « 1re », jamais « 1e »", () => {
  assert.equal(ordinal(1), "1re");
  assert.equal(ordinal(2), "2e");
  assert.match(claimReplyDraft(report({ rank: 1 }), "u").body, /1re sur 12 marques/);
});

test("qui écrit : la marque, une messagerie personnelle, ou un autre domaine", () => {
  assert.equal(emailOrigin("marie@laroche-posay.fr", "La Roche-Posay"), "marque");
  assert.equal(emailOrigin("p.durand@fr.loreal.com", "L'Oréal"), "marque");
  assert.equal(emailOrigin("hello@nutriandco.com", "Nutri&Co"), "marque");
  assert.equal(emailOrigin("contact@soleiltest.com", "Soleil Test"), "marque");
  assert.equal(emailOrigin("marie@gmail.com", "La Roche-Posay"), "personnelle");
  assert.equal(emailOrigin("marie@orange.fr", "La Roche-Posay"), "personnelle");
  assert.equal(emailOrigin("seo@agence-exemple.fr", "La Roche-Posay"), "autre");
  // Une marque courte ne rattache pas n'importe quel domaine qui la contient.
  assert.equal(emailOrigin("x@avenue.com", "Ave"), "autre");
});

test("le brouillon s'ouvre dans le client mail, encodé", () => {
  const url = claimMailto("a@b.fr", { subject: "Objet & co", body: "Ligne 1\nLigne 2" });
  assert.equal(url, "mailto:a@b.fr?subject=Objet%20%26%20co&body=Ligne%201%0ALigne%202");
});
