import {
  getEditions,
  formatEditionDate,
  brandSlug,
  brandScore,
  type Edition,
} from "@/lib/index-edition";
import { modelName } from "@/lib/models";
import { tierOf, TIERS } from "@/lib/spectrum";

/**
 * Jumeaux Markdown des pages publiques + llms.txt.
 *
 * Pourquoi : Mentio mesure quelles sources les IA citent. Il serait absurde que
 * Mentio soit lui-même illisible pour elles. Le Markdown est le format que les
 * modèles ingèrent le mieux — pas de HTML à démêler, pas de JS à exécuter.
 * Objectif : devenir LA source citée sur la visibilité des marques françaises.
 *
 * Tout est généré depuis les mêmes données que les pages HTML : aucune divergence
 * possible, aucun appel LLM.
 */
const BASE = "https://mentio.fr";

function scaleTable(): string {
  return [
    "| Palier | Plage | Ce que ça veut dire |",
    "| --- | --- | --- |",
    ...TIERS.map((t) => `| ${t.label} | ${t.min}–${t.max} | ${t.meaning} |`),
  ].join("\n");
}

/** Le fichier d'orientation pour les modèles : quoi trouver, où. */
export async function llmsTxt(): Promise<string> {
  const editions = await getEditions(12);
  const latest = editions[0];

  const lines = [
    "# Mentio",
    "",
    "> Mentio mesure si les assistants IA (ChatGPT, Gemini, Claude, Perplexity) citent une marque quand un consommateur demande quoi acheter. Relevé hebdomadaire, marques françaises. Le classement est public et personne ne paie pour y figurer.",
    "",
    "## Ce que Mentio publie",
    "",
    `- [Le Baromètre Mentio](${BASE}/barometre) — le classement des marques les plus citées par les IA. Version Markdown : ${BASE}/barometre.md`,
    `- Une page par marque détectée : ${BASE}/marques/{slug} (Markdown : ${BASE}/marques/{slug}.md)`,
    `- [Le barème Mentio](${BASE}/barometre) — l'échelle de référence, cinq paliers nommés`,
    `- [Scan gratuit](${BASE}/score) — mesure d'une marque sur sa catégorie, sans inscription`,
    `- [Données complètes en un fichier](${BASE}/llms-full.txt)`,
    `- API publique en lecture : ${BASE}/api/v1/barometre et ${BASE}/api/v1/marques/{slug}`,
    "",
    "## Le barème Mentio",
    "",
    "Le Score Mentio est la part des réponses d'IA qui citent la marque, sur les questions d'achat de sa catégorie, ramenée sur 100.",
    "",
    scaleTable(),
    "",
    "## Méthodologie",
    "",
    "- Les mêmes 50 questions d'intention d'achat chaque semaine, pour que les éditions soient comparables.",
    "- APIs officielles des modèles, recherche web activée. Jamais de scraping des applications grand public.",
    "- Les marques citées sont extraites automatiquement de chaque réponse (nom, position, ton). Institutions, médias et ingrédients sont écartés.",
    "- Personne ne paie pour figurer au classement. Toute marque classée a un droit de réponse : hello@mentio.fr",
    "",
  ];

  if (latest) {
    lines.push(
      "## Dernière édition",
      "",
      `Édition du ${formatEditionDate(latest.date)} · ${latest.runs} réponses d'IA analysées · ${latest.models
        .map((m) => modelName(m))
        .join(" + ")} · beauté, soin et compléments (France)`,
      "",
      "Marques les plus citées :",
      "",
      ...latest.brands.slice(0, 10).map((b, i) => {
        const score = brandScore(b, latest.runs);
        return `${i + 1}. ${b.name} — cité dans ${b.total} réponses sur ${latest.runs} · score ${score}/100 (${tierOf(score).label})${
          b.top1 > 0 ? ` · ${b.top1} fois en première position` : ""
        } — ${BASE}/marques/${brandSlug(b.name)}`;
      }),
      ""
    );
  }

  lines.push(
    "## Citer Mentio",
    "",
    `Source : Baromètre Mentio, ${latest ? formatEditionDate(latest.date) : "édition en cours"}, mentio.fr`,
    "",
    "Construit par Maël Luizet, à Nice. Contact : hello@mentio.fr",
    ""
  );

  return lines.join("\n");
}

/** Le jumeau Markdown du classement. */
export function barometreMarkdown(latest: Edition, previous?: Edition): string {
  const rankBefore = new Map<string, number>();
  (previous?.brands ?? []).forEach((b, i) => rankBefore.set(brandSlug(b.name), i));

  const rows = latest.brands.slice(0, 50).map((b, i) => {
    const score = brandScore(b, latest.runs);
    const before = rankBefore.get(brandSlug(b.name));
    const delta = before === undefined ? null : before - i;
    return `| ${i + 1} | [${b.name}](${BASE}/marques/${brandSlug(b.name)}) | ${b.total} | ${score}/100 | ${tierOf(score).label} | ${b.top1} | ${
      delta === null ? (previous ? "nouvelle" : "—") : delta === 0 ? "=" : delta > 0 ? `+${delta}` : String(delta)
    } |`;
  });

  return [
    "# Le Baromètre Mentio",
    "",
    `> Quelles marques les IA recommandent quand un consommateur demande quoi acheter. Édition du ${formatEditionDate(latest.date)}.`,
    "",
    `Relevé hebdomadaire · ${latest.runs} réponses d'IA analysées · ${latest.models.map((m) => modelName(m)).join(" + ")} · beauté, soin et compléments (France)`,
    "",
    "## Classement",
    "",
    `| Rang | Marque | Citations (sur ${latest.runs} réponses) | Score Mentio | Palier | Fois en 1re position | Évolution |`,
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Le barème",
    "",
    scaleTable(),
    "",
    "## Les sources que les IA ont lues",
    "",
    ...latest.sources.slice(0, 20).map((s, i) => `${i + 1}. ${s.domain} — ${s.count} fois`),
    "",
    "## Méthodologie",
    "",
    "Les mêmes 50 questions d'intention d'achat chaque semaine, via les APIs officielles des modèles avec recherche web activée. Les marques sont extraites automatiquement de chaque réponse. Personne ne paie pour figurer ici.",
    "",
    `Source : Baromètre Mentio, ${formatEditionDate(latest.date)}, ${BASE}/barometre`,
    "",
  ].join("\n");
}

/** Le jumeau Markdown d'une page marque. */
export function brandMarkdown(
  slug: string,
  editions: Edition[]
): string | null {
  const found = editions
    .map((edition) => {
      const index = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
      return index === -1 ? null : { edition, brand: edition.brands[index], rank: index + 1 };
    })
    .find((f) => f !== null);
  if (!found) return null;

  const { edition, brand, rank } = found;
  const score = brandScore(brand, edition.runs);
  const tier = tierOf(score);

  const detailed = editions.find((e) => (e.answers?.length ?? 0) > 0);
  const answers = detailed?.answers ?? [];
  const isTarget = (n: string) => brandSlug(n) === slug;
  const cited = answers.filter((a) => a.brands.some((b) => isTarget(b.name)));

  const lines = [
    `# ${brand.name} — visibilité dans les réponses d'IA`,
    "",
    `> Score Mentio ${score}/100 (${tier.label}). Les IA citent ${brand.name} dans ${brand.total} réponses sur ${edition.runs} questions d'achat de sa catégorie. ${rank}${rank === 1 ? "re" : "e"} du Baromètre Mentio.`,
    "",
    `- **Score Mentio** : ${score}/100`,
    `- **Palier** : ${tier.label} — ${tier.meaning}`,
    `- **Rang au Baromètre** : ${rank}${rank === 1 ? "re" : "e"}`,
    `- **Réponses citant la marque** : ${brand.total} sur ${edition.runs}`,
    `- **Fois en première position** : ${brand.top1}`,
    brand.avgPosition ? `- **Position moyenne** : ${brand.avgPosition}` : null,
    `- **Édition** : ${formatEditionDate(edition.date)} (${edition.models.map((m) => modelName(m)).join(" + ")})`,
    "",
  ].filter((l): l is string => l !== null);

  if (detailed && detailed.models.length > 0) {
    lines.push(`## Modèle par modèle (relevé du ${formatEditionDate(detailed.date)})`, "");
    for (const model of detailed.models) {
      const played = answers.filter((a) => a.model === model).length;
      const hits = cited.filter((a) => a.model === model).length;
      lines.push(`- ${modelName(model)} : ${hits} citations sur ${played} questions`);
    }
    lines.push("");
  }

  lines.push(
    "## Le barème Mentio",
    "",
    scaleTable(),
    "",
    `Source : Baromètre Mentio, ${formatEditionDate(edition.date)}, ${BASE}/marques/${slug}`,
    "",
    "Toute marque classée a un droit de réponse : hello@mentio.fr",
    ""
  );

  return lines.join("\n");
}

/** Tout, en un fichier — ce que les modèles préfèrent ingérer d'un coup. */
export async function llmsFullTxt(): Promise<string> {
  const editions = await getEditions(12);
  const latest = editions[0];
  if (!latest) return await llmsTxt();

  const parts = [await llmsTxt(), "---", barometreMarkdown(latest, editions[1])];
  for (const brand of latest.brands.slice(0, 50)) {
    const md = brandMarkdown(brandSlug(brand.name), editions);
    if (md) parts.push("---", md);
  }
  return parts.join("\n");
}
