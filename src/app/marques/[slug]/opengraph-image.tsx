import { ImageResponse } from "next/og";
import { getEditionsForBrand, brandSlug, brandScore, citationCount } from "@/lib/index-edition";
import { tierOf } from "@/lib/spectrum";

export const alt = "Score de visibilité IA — Baromètre Mentio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/**
 * L'image partagée quand quelqu'un envoie une page marque. Elle porte le score et
 * le palier : chaque partage diffuse le vocabulaire du barème. Générée à la demande,
 * mise en cache — aucun appel LLM.
 */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editions = await getEditionsForBrand(slug, 12);

  const found = editions
    .map((edition) => {
      const i = edition.brands.findIndex((b) => brandSlug(b.name) === slug);
      return i === -1 ? null : { edition, brand: edition.brands[i], rank: i + 1 };
    })
    .find((f) => f !== null);

  const name = found?.brand.name ?? slug;
  const score = found ? brandScore(found.brand, found.edition.runs) : 0;
  const tier = tierOf(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ECEAF1",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        {/* Marque + barres du logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 30 }}>
            {["#727387", "#7A5FA8", "#EF8060", "#E7A94B", "#E8462B"].map((c, i) => (
              <div
                key={c}
                style={{ width: 6, height: 10 + i * 5, backgroundColor: c, borderRadius: 2 }}
              />
            ))}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#171520", letterSpacing: -0.5 }}>
            Mentio
          </div>
          <div style={{ fontSize: 18, color: "#544F60", marginLeft: 10 }}>
            Baromètre de la visibilité IA
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, marginTop: 24 }}>
          {/* Le score, en pigment */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: tier.hex,
              borderRadius: 32,
              padding: 36,
              width: 320,
              height: 320,
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.75)",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Score Mentio
            </div>
            <div style={{ display: "flex", alignItems: "baseline", color: "#fff" }}>
              <div style={{ fontSize: 128, fontWeight: 800, lineHeight: 1 }}>{String(score)}</div>
              <div style={{ fontSize: 36, color: "rgba(255,255,255,0.6)" }}>/100</div>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {tier.label}
            </div>
          </div>

          {/* Le nom et la lecture */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                fontSize: name.length > 18 ? 62 : 82,
                fontWeight: 800,
                color: "#171520",
                lineHeight: 1,
                letterSpacing: -2,
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: 28, color: "#544F60", marginTop: 24, lineHeight: 1.4 }}>
              {found
                ? `Cité dans ${citationCount(found.brand.total)} réponses d'IA sur ${found.edition.runs} questions d'achat de sa catégorie.`
                : "Marque non détectée dans les éditions publiées."}
            </div>
            {found && (
              <div style={{ fontSize: 22, color: "#544F60", marginTop: 18 }}>
                {`${found.rank === 1 ? "1re" : `${found.rank}e`} du Baromètre · ${
                  found.brand.top1 > 0
                    ? `${found.brand.top1} fois en 1re position`
                    : "jamais en tête"
                }`}
              </div>
            )}
          </div>
        </div>

        {/* Le spectre complet, en pied */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden" }}>
            {["#727387", "#7A5FA8", "#EF8060", "#E7A94B", "#E8462B"].map((c) => (
              <div key={c} style={{ flex: 1, backgroundColor: c }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: "#544F60" }}>
            <div>Invisible → Prescrite · mentio.fr</div>
            <div>Personne ne paie pour être classé</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
