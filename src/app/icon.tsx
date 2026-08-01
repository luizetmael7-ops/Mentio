import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * L'icône d'onglet, générée depuis la marque.
 *
 * Elle était auparavant servie depuis app/icon.svg. Les navigateurs mettent les
 * favicons en cache de façon très agressive — souvent au-delà d'un rechargement
 * forcé — et l'ancienne icône continuait de s'afficher. En passant par une route
 * générée, l'URL change (/icon au lieu de /icon.svg), ce qui invalide le cache.
 */
export default function Icon() {
  const bars = [
    { h: 14, color: "#7A5FA8" },
    { h: 21, color: "#EF8060" },
    { h: 28, color: "#E7A94B" },
    { h: 35, color: "#E8462B" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
          paddingBottom: 14,
          backgroundColor: "#1F1830",
        }}
      >
        {bars.map((bar) => (
          <div
            key={bar.color}
            style={{ width: 7, height: bar.h, borderRadius: 4, backgroundColor: bar.color }}
          />
        ))}
      </div>
    ),
    size
  );
}
