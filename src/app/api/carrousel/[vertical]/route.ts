import { createElement } from "react";
import { ImageResponse } from "next/og";
import { PDFDocument } from "pdf-lib";
import { categoryBySlug, categoryByKey, countryByCode, categoryPath } from "@/lib/index-catalog";
import { getLatestSummaries, brandScore, formatEditionDate, DEFAULT_VERTICAL } from "@/lib/index-edition";
import { modelName } from "@/lib/models";
import { TIERS } from "@/lib/spectrum";
import { RankingCard, LogoBars } from "@/lib/og/ranking-card";

/**
 * LE CARROUSEL LINKEDIN — un PDF de cinq pages par catégorie publiée.
 *
 * Un classement nominatif, daté, qui nomme les paliers : c'est le contenu qui
 * installe le vocabulaire (constitution §2) là où les agences et les marques le
 * lisent. Généré depuis l'édition publiée, sans appel payant. Le fondateur le
 * télécharge depuis le cockpit et le publie lui-même (§8.1).
 *
 *   GET /api/carrousel/creme-solaire-fr   (ou /api/carrousel/barometre)
 */
const W = 1080;
const H = 1350;

function Page({ children }: { children: React.ReactNode }) {
  return createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ECEAF1",
        padding: 90,
        fontFamily: "sans-serif",
        color: "#171520",
      },
    },
    children
  );
}

async function png(node: React.ReactElement): Promise<Uint8Array> {
  const res = new ImageResponse(node, { width: W, height: H });
  return new Uint8Array(await res.arrayBuffer());
}

export async function GET(_request: Request, { params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const category = vertical === "barometre" ? await categoryByKey(DEFAULT_VERTICAL) : await categoryBySlug(vertical);
  const summary = category ? (await getLatestSummaries()).get(category.key) : undefined;
  if (!category || !summary) return new Response("Catégorie non publiée", { status: 404 });

  const country = countryByCode(category.country);
  const date = formatEditionDate(summary.date);
  const engines = summary.models.map((m) => modelName(m)).join(" et ");
  const rows = summary.brands.map((b) => ({ name: b.name, score: brandScore(b, summary.runs) }));
  const url = `mentio.fr${categoryPath(category)}`;

  const cover = createElement(
    Page,
    null,
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 16 } },
      createElement(LogoBars, { size: 40 }),
      createElement("div", { style: { fontSize: 34, fontWeight: 700 } }, "Mentio")
    ),
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" } },
      createElement("div", { style: { fontSize: 30, color: "#544F60", letterSpacing: 3, textTransform: "uppercase" } }, `Édition du ${date}`),
      createElement(
        "div",
        { style: { fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1, marginTop: 28 } },
        `Quand on demande à ${engines} : ${category.label.toLowerCase()}${country ? ` (${country.name})` : ""}`
      ),
      createElement("div", { style: { fontSize: 38, color: "#544F60", marginTop: 36 } }, "Quelles marques recommandent-ils ?")
    ),
    createElement("div", { style: { display: "flex", fontSize: 26, color: "#544F60" } }, "Faites défiler →")
  );

  const podium = createElement(RankingCard, {
    eyebrow: "Le classement",
    title: `${category.label} — les 5 premières`,
    subtitle: `${summary.runs} réponses · ${engines} · recherche web`,
    rows: rows.slice(0, 5),
    footer: `Édition du ${date}`,
    width: W,
    height: H,
  });

  const next = createElement(RankingCard, {
    eyebrow: "La suite",
    title: rows.length > 5 ? "De la 6e à la 10e place" : "Les autres marques",
    subtitle: `${rows.length} marques citées au total`,
    rows: rows.slice(5, 10),
    footer: `Classement complet : ${url}`,
    width: W,
    height: H,
  });

  const scale = createElement(
    Page,
    null,
    createElement("div", { style: { fontSize: 30, color: "#544F60", letterSpacing: 3, textTransform: "uppercase" } }, "Lire le Score Mentio"),
    createElement(
      "div",
      { style: { fontSize: 64, fontWeight: 800, letterSpacing: -2, marginTop: 24, lineHeight: 1.05 } },
      "Cinq paliers, un barème public"
    ),
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 34, marginTop: 64, flex: 1 } },
      ...TIERS.map((t) =>
        createElement(
          "div",
          { key: t.key, style: { display: "flex", alignItems: "center", gap: 28 } },
          createElement("div", { style: { width: 40, height: 40, borderRadius: 99, backgroundColor: t.hex } }),
          createElement(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            createElement("div", { style: { fontSize: 40, fontWeight: 800 } }, `${t.label} · ${t.min}–${t.max}`),
            createElement("div", { style: { fontSize: 24, color: "#544F60", maxWidth: 800 } }, t.meaning)
          )
        )
      )
    ),
    createElement("div", { style: { display: "flex", fontSize: 26, color: "#544F60" } }, "Score = réponses citant la marque ÷ réponses analysées × 100")
  );

  const method = createElement(
    Page,
    null,
    createElement("div", { style: { fontSize: 30, color: "#544F60", letterSpacing: 3, textTransform: "uppercase" } }, "La méthode"),
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 30, marginTop: 40, flex: 1, fontSize: 36, lineHeight: 1.35 } },
      createElement("div", null, `Les mêmes questions d'achat à chaque édition, posées à ${engines} par leurs API officielles, recherche web activée.`),
      createElement("div", null, "Une édition n'est publiée que si chaque moteur a répondu à 80 % des questions au moins."),
      createElement("div", null, "Aucun classement ne s'achète. Toute marque peut demander une correction."),
      createElement("div", { style: { fontWeight: 800, fontSize: 44, marginTop: 30 } }, "Votre marque est-elle citée ?"),
      createElement("div", { style: { color: "#544F60" } }, "Ajoutez-la à l'Index : mentio.fr/ajouter")
    ),
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 16 } },
      createElement(LogoBars, { size: 34 }),
      createElement("div", { style: { fontSize: 30, fontWeight: 700 } }, url)
    )
  );

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${category.label} — Index Mentio, édition du ${date}`);
  pdf.setAuthor("Mentio");
  for (const node of [cover, podium, next, scale, method]) {
    const image = await pdf.embedPng(await png(node));
    const page = pdf.addPage([W, H]);
    page.drawImage(image, { x: 0, y: 0, width: W, height: H });
  }
  const bytes = await pdf.save();
  return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mentio-${category.slug}-${summary.date}.pdf"`,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
