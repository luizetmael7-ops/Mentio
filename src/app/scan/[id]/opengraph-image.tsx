import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TIERS, tierOf } from "@/lib/spectrum";

export const alt = "AI visibility reading — Mentio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * La couleur d'un score, lue dans le barème. Cette image avait ses propres seuils
 * (85/65/45/20) : un score de 60 y prenait la couleur de « Citée » au lieu de
 * « Recommandée ». Constitution §3 : aucune redéfinition hors de spectrum.ts.
 */
const colorOf = (value: number) => tierOf(value).hex;

interface Teaser {
  score: number;
  perModel: Array<{ model: string; citedCount: number; runCount: number }>;
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = supabaseAdmin();
  const { data: scan } = await admin
    .from("public_scans")
    .select("brand_name, teaser")
    .eq("id", id)
    .single();

  const teaser = (scan?.teaser ?? null) as Teaser | null;
  const score = teaser?.score ?? 0;
  const models = teaser?.perModel?.length
    ? teaser.perModel
    : [
        { model: "chatgpt", citedCount: 0, runCount: 10 },
        { model: "gemini", citedCount: 0, runCount: 10 },
      ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1F1830",
          color: "#fff",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logomark */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 36 }}>
            {TIERS.map((t) => t.hex).map((color, i) => (
              <div
                key={i}
                style={{
                  width: 9,
                  height: 12 + i * 6,
                  backgroundColor: color,
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>
            Mentio<span style={{ color: "#E8462B" }}>.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)", letterSpacing: 4 }}>
            AI VISIBILITY READING
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 8 }}>
            <div style={{ fontSize: 72, fontWeight: 900 }}>{scan?.brand_name ?? "Your brand"}</div>
            <div style={{ fontSize: 96, fontWeight: 900, color: colorOf(score) }}>{score}</div>
            <div style={{ fontSize: 40, color: "rgba(255,255,255,0.5)" }}>/100</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {models.slice(0, 4).map((m) => {
            const value = m.runCount > 0 ? Math.round((m.citedCount / m.runCount) * 100) : 0;
            return (
              <div key={m.model} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div
                  style={{
                    height: 110,
                    borderRadius: 18,
                    backgroundColor: colorOf(value),
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 14,
                    fontSize: 40,
                    fontWeight: 800,
                  }}
                >
                  {m.citedCount}/{m.runCount}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 22,
                    letterSpacing: 3,
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "uppercase",
                  }}
                >
                  {m.model}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.55)" }}>
          Perception, measured · mentio.fr
        </div>
      </div>
    ),
    { ...size }
  );
}
