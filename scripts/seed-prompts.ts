/**
 * Seed de la librairie de prompts mutualisée — verticale beauté / cosmétique / compléments (FR).
 * Usage : npm run seed:prompts  (idempotent : ne réinsère pas si la librairie existe déjà ; --force pour remplacer)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const VERTICAL = "beaute_complements";

type Intent = "best_of" | "comparison" | "recommendation" | "problem_solution";

const PROMPTS: Array<{ text: string; intent: Intent }> = [
  // --- best_of : « quelle est la meilleure… » ---
  { text: "Quelle est la meilleure crème solaire visage clean ?", intent: "best_of" },
  { text: "Quelles sont les meilleures marques françaises de soins de la peau ?", intent: "best_of" },
  { text: "Quel est le meilleur sérum à la vitamine C ?", intent: "best_of" },
  { text: "Quelle est la meilleure crème anti-âge rapport qualité-prix ?", intent: "best_of" },
  { text: "Quelles sont les meilleures marques de cosmétiques bio ?", intent: "best_of" },
  { text: "Quel est le meilleur complément alimentaire pour la pousse des cheveux ?", intent: "best_of" },
  { text: "Quelles sont les meilleures gummies pour les cheveux ?", intent: "best_of" },
  { text: "Quel est le meilleur collagène marin ?", intent: "best_of" },
  { text: "Quelle est la meilleure marque française de compléments alimentaires ?", intent: "best_of" },
  { text: "Quel est le meilleur magnésium contre la fatigue ?", intent: "best_of" },
  { text: "Quelles sont les meilleures vitamines pour lutter contre la fatigue ?", intent: "best_of" },
  { text: "Quel est le meilleur probiotique pour la digestion ?", intent: "best_of" },
  { text: "Quelle est la meilleure huile visage anti-âge ?", intent: "best_of" },
  { text: "Quel est le meilleur soin anti-imperfections ?", intent: "best_of" },
  { text: "Quelles sont les meilleures marques de skincare clean ?", intent: "best_of" },
  { text: "Quel est le meilleur autobronzant naturel ?", intent: "best_of" },
  { text: "Quelle est la meilleure protéine en poudre pour femme ?", intent: "best_of" },
  { text: "Quels sont les meilleurs compléments alimentaires pour une belle peau ?", intent: "best_of" },
  { text: "Quelle est la meilleure crème hydratante pour peau sensible ?", intent: "best_of" },
  { text: "Quel est le meilleur shampoing anti-chute de cheveux ?", intent: "best_of" },

  // --- recommendation : « que me conseilles-tu… » ---
  { text: "Quelle marque de compléments alimentaires me conseilles-tu pour mieux dormir ?", intent: "recommendation" },
  { text: "Je cherche une routine skincare simple et efficace, quelles marques recommandes-tu ?", intent: "recommendation" },
  { text: "Quelle crème solaire recommandes-tu pour une peau acnéique ?", intent: "recommendation" },
  { text: "Peux-tu me recommander une marque de cosmétiques vegan française ?", intent: "recommendation" },
  { text: "Quel complément alimentaire recommandes-tu contre le stress ?", intent: "recommendation" },
  { text: "Quelle marque recommandes-tu pour des soins anti-taches pigmentaires ?", intent: "recommendation" },
  { text: "Je veux renforcer mes ongles et mes cheveux, quels produits me conseilles-tu ?", intent: "recommendation" },
  { text: "Quel sérum à l'acide hyaluronique me conseilles-tu ?", intent: "recommendation" },
  { text: "Quelle marque de maquillage clean me recommandes-tu ?", intent: "recommendation" },
  { text: "Que recommandes-tu comme complément de fer pour une femme ?", intent: "recommendation" },
  { text: "Quelle routine anti-âge recommandes-tu à partir de 40 ans ?", intent: "recommendation" },
  { text: "Peux-tu me conseiller des soins pour peau sensible et réactive ?", intent: "recommendation" },
  { text: "Quels compléments conseilles-tu pour booster l'immunité en hiver ?", intent: "recommendation" },
  { text: "Quelle marque d'huile de CBD pour dormir me recommandes-tu ?", intent: "recommendation" },
  { text: "Où acheter du collagène de bonne qualité en France ?", intent: "recommendation" },

  // --- comparison : « X ou Y ? » ---
  { text: "Typology ou The Ordinary : quelle marque de skincare choisir ?", intent: "comparison" },
  { text: "Respire ou Nuxe : quelle marque de déodorant naturel est la meilleure ?", intent: "comparison" },
  { text: "Nutri&Co ou Novoma : quelle marque de compléments choisir ?", intent: "comparison" },
  { text: "Aime ou D+ For Care : quelles gummies beauté choisir ?", intent: "comparison" },
  { text: "La Roche-Posay ou Avène pour une peau sensible ?", intent: "comparison" },
  { text: "Caudalie ou Typology : quels soins visage choisir ?", intent: "comparison" },
  { text: "Luxéol ou Hairburst : quel complément capillaire est le plus efficace ?", intent: "comparison" },
  { text: "Collagène en poudre ou en gélules : lequel choisir et quelle marque ?", intent: "comparison" },

  // --- problem_solution : « j'ai un problème, quels produits ? » ---
  { text: "J'ai la peau grasse avec des imperfections, quels produits utiliser ?", intent: "problem_solution" },
  { text: "Comment lutter contre la chute de cheveux après une grossesse, quels produits ?", intent: "problem_solution" },
  { text: "Quels produits pour atténuer les cernes et les poches sous les yeux ?", intent: "problem_solution" },
  { text: "J'ai des ballonnements et une digestion difficile, quels probiotiques prendre ?", intent: "problem_solution" },
  { text: "Je suis fatiguée en permanence, quels compléments alimentaires prendre ?", intent: "problem_solution" },
  { text: "Quels soins utiliser contre l'eczéma sur le visage ?", intent: "problem_solution" },
  { text: "Comment améliorer naturellement la qualité de mon sommeil, quels compléments ?", intent: "problem_solution" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local");

  const supabase = createClient(url, serviceKey);
  const force = process.argv.includes("--force");

  const { count, error: countError } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("vertical", VERTICAL)
    .is("brand_id", null);
  if (countError) throw countError;

  if ((count ?? 0) > 0) {
    if (!force) {
      console.log(`La librairie ${VERTICAL} contient déjà ${count} prompts — rien à faire (--force pour remplacer).`);
      return;
    }
    const { error } = await supabase.from("prompts").delete().eq("vertical", VERTICAL).is("brand_id", null);
    if (error) throw error;
    console.log(`Librairie existante supprimée (${count} prompts).`);
  }

  const { error } = await supabase
    .from("prompts")
    .insert(PROMPTS.map((p) => ({ vertical: VERTICAL, text: p.text, intent: p.intent, is_active: true })));
  if (error) throw error;

  console.log(`✅ ${PROMPTS.length} prompts insérés dans la librairie ${VERTICAL}.`);
}

main().catch((e) => {
  console.error("❌ Seed échoué :", e.message ?? e);
  process.exit(1);
});
