/**
 * Prépare l'édition « Agences GEO France » — les 50 questions.
 *
 * Ce script INSÈRE seulement les questions en base. Il ne lance aucune mesure et
 * ne coûte rien. L'édition elle-même se déclenche ensuite par l'événement
 * `mentio/index.refresh`, sous plafond du coupe-circuit.
 *
 * Pourquoi cette édition compte plus que les autres : elle débloque treize emails
 * du palier 1, et elle donne à Julien Gourdon — qui publie le classement de
 * référence des agences GEO — une donnée que personne d'autre n'a. Une reprise
 * chez lui met Mentio dans l'article que toutes les cibles lisent.
 *
 *   npx tsx scripts/seed-vertical-agences.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const VERTICAL = "agences_geo";

/**
 * Les 50 questions. Écrites comme les tape un dirigeant qui cherche un prestataire,
 * pas comme un référenceur pense les mots-clés. Elles ne changeront plus : la
 * comparabilité d'une édition à l'autre est l'actif du Baromètre.
 */
const QUESTIONS = [
  // — Recherche directe de prestataire —
  "Quelle agence GEO choisir en France ?",
  "Quelle est la meilleure agence de référencement IA en France ?",
  "Qui peut m'aider à être cité par ChatGPT ?",
  "Quelle agence pour être visible dans les réponses des IA ?",
  "Meilleure agence GEO à Paris ?",
  "Quelle agence spécialisée en Generative Engine Optimization recommandes-tu ?",
  "Je cherche une agence qui fait du référencement sur ChatGPT, laquelle ?",
  "Quelle agence française pour optimiser ma visibilité sur Perplexity ?",
  "Existe-t-il des agences AEO en France ?",
  "Quelle agence de référencement pour les moteurs génératifs ?",
  // — Par besoin métier —
  "Ma marque n'apparaît jamais dans ChatGPT, qui peut m'aider ?",
  "Comment faire pour que mon site soit cité par les IA, et par qui ?",
  "Qui fait des audits de visibilité IA en France ?",
  "Quelle agence peut mesurer ma présence dans les réponses de ChatGPT ?",
  "Je veux améliorer ma visibilité IA, quelle agence contacter ?",
  "Quelle agence pour une stratégie de contenu optimisée pour les LLM ?",
  "Qui peut m'accompagner sur le llms.txt et les données structurées ?",
  "Quelle agence pour du SEO nouvelle génération avec l'IA ?",
  "Comment choisir une agence GEO sérieuse ?",
  "Quels sont les critères pour choisir une agence de référencement IA ?",
  // — Comparatif et classement —
  "Quelles sont les meilleures agences GEO françaises ?",
  "Classement des agences de référencement IA en France",
  "Top des agences GEO en 2026",
  "Quelles agences françaises sont spécialisées en visibilité ChatGPT ?",
  "Agence SEO ou agence GEO, laquelle choisir ?",
  "Quelle différence entre une agence SEO classique et une agence GEO ?",
  "Quelles agences françaises publient sur le GEO ?",
  "Qui sont les acteurs du GEO en France ?",
  "Quelles agences web maîtrisent le référencement dans les IA ?",
  "Meilleures agences de search marketing IA en France",
  // — Par secteur du client —
  "Quelle agence GEO pour une marque de cosmétique ?",
  "Quelle agence pour améliorer la visibilité IA d'un site e-commerce ?",
  "Quelle agence GEO pour une entreprise B2B ?",
  "Quelle agence pour le référencement IA d'un SaaS français ?",
  "Quelle agence GEO pour une marque DTC ?",
  "Quelle agence pour la visibilité IA d'une PME française ?",
  "Quelle agence GEO pour un site de e-commerce beauté ?",
  "Quelle agence peut aider une startup à être citée par les IA ?",
  // — Par ville —
  "Agence GEO Lyon",
  "Agence de référencement IA Bordeaux",
  "Agence GEO Marseille",
  "Agence visibilité ChatGPT Lille",
  "Agence GEO Nantes",
  // — Prix et fonctionnement —
  "Combien coûte une prestation GEO en France ?",
  "Quel budget pour une agence de référencement IA ?",
  "Comment travaille une agence GEO concrètement ?",
  "Une agence GEO, ça sert vraiment à quelque chose ?",
  "Quels outils utilisent les agences pour mesurer la visibilité IA ?",
  "Quelle agence propose un suivi de la visibilité dans les réponses IA ?",
  "Peut-on mesurer le ROI d'une prestation GEO ?",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env Supabase manquante");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  // Idempotent : on repart d'une base propre pour cette verticale
  const del = await fetch(`${url}/rest/v1/prompts?vertical=eq.${VERTICAL}`, {
    method: "DELETE",
    headers,
  });
  if (!del.ok) throw new Error(`Suppression : ${del.status} ${await del.text()}`);

  const res = await fetch(`${url}/rest/v1/prompts`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      QUESTIONS.map((text) => ({ text, vertical: VERTICAL, brand_id: null, is_active: true }))
    ),
  });
  if (!res.ok) throw new Error(`Insertion : ${res.status} ${await res.text()}`);

  console.log(`\n✅ ${QUESTIONS.length} questions insérées pour la verticale « ${VERTICAL} »`);
  console.log(`   Aucune mesure lancée, aucun coût engagé.\n`);
  console.log(`   Pour produire l'édition (≈ 1,50 $ en échantillonnage stratifié) :`);
  console.log(`   npx tsx scripts/trigger-run.ts  — ou envoyer l'événement Inngest`);
  console.log(`   mentio/index.refresh avec { "vertical": "${VERTICAL}" }\n`);
  console.log(`   Cette dépense doit être validée avant d'être engagée (constitution §7).\n`);
}

main().catch((e) => {
  console.error("❌", e.message ?? e);
  process.exit(1);
});
