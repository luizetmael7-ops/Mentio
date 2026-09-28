import { TIERS, tierOf } from "@/lib/spectrum";

/**
 * La carte d'un classement — pour les images de partage et le carrousel.
 *
 * Même grammaire que le site : le nom de la catégorie, les marques, leur score
 * et leur palier nommé, la date. Les couleurs viennent du barème (constitution
 * §3), jamais recopiées. Rendue par `next/og` : styles en ligne, flexbox seul.
 */
export interface RankingRow {
  name: string;
  score: number;
}

export function LogoBars({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: size / 7.5, height: size }}>
      {TIERS.map((t, i) => (
        <div key={t.key} style={{ width: size / 5, height: size / 3 + (i * size) / 6, backgroundColor: t.hex, borderRadius: 2 }} />
      ))}
    </div>
  );
}

export function RankingCard({
  eyebrow,
  title,
  subtitle,
  rows,
  footer,
  width = 1200,
  height = 630,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  rows: RankingRow[];
  footer: string;
  width?: number;
  height?: number;
}) {
  const tall = height > width;
  const scale = tall ? 1.15 : 1;
  // En paysage (1200×630), quatre lignes au plus : cinq débordaient sur le pied.
  const shown = rows.slice(0, tall ? 5 : 4);
  const max = Math.max(10, ...rows.map((r) => r.score));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ECEAF1",
        padding: tall ? 80 : 64,
        fontFamily: "sans-serif",
        color: "#171520",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <LogoBars size={28 * scale} />
        <div style={{ fontSize: 26 * scale, fontWeight: 700, letterSpacing: -0.5 }}>Mentio</div>
        <div style={{ fontSize: 18 * scale, color: "#544F60", marginLeft: 10, letterSpacing: 2, textTransform: "uppercase" }}>
          {eyebrow}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: tall ? (title.length > 28 ? 60 : 74) : title.length > 28 ? 46 : 56, fontWeight: 800, letterSpacing: -2, marginTop: tall ? 56 : 24, lineHeight: 1.05 }}>
        {title}
      </div>
      <div style={{ display: "flex", fontSize: tall ? 28 : 22, color: "#544F60", marginTop: 10 }}>{subtitle}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: tall ? 26 : 12, marginTop: tall ? 56 : 22, flex: 1 }}>
        {shown.map((r, i) => {
          const tier = tierOf(r.score);
          return (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", width: 44 * scale, fontSize: 22 * scale, color: "#544F60" }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ display: "flex", fontSize: tall ? 34 : 26, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ display: "flex", fontSize: tall ? 28 : 22, color: "#544F60" }}>
                    <span style={{ color: "#171520", fontWeight: 700 }}>{String(r.score)}</span>
                    {/* Espace insécable : le moteur d'image rogne les espaces en tête de bloc. */}
                    <span>{`\u00a0· ${tier.label}`}</span>
                  </div>
                </div>
                <div style={{ display: "flex", height: tall ? 14 : 10, backgroundColor: "#D6D2DF", borderRadius: 99 }}>
                  <div style={{ display: "flex", width: `${Math.max(3, (r.score / max) * 100)}%`, height: "100%", backgroundColor: tier.hex, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: tall ? 24 : 18, color: "#544F60", marginTop: 16 }}>
        <div style={{ display: "flex" }}>{footer}</div>
        <div style={{ display: "flex", fontWeight: 700, color: "#171520" }}>mentio.fr</div>
      </div>
    </div>
  );
}
