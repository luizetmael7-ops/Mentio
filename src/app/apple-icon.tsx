import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Icône iOS (écran d'accueil). Générée depuis la marque, comme icon.svg :
 * les barres ascendantes du spectre sur fond prune.
 *
 * Le favicon.ico par défaut de Next avait été laissé dans le projet et primait
 * sur icon.svg — c'est pour ça que l'onglet affichait l'icône de Vercel.
 */
export default function AppleIcon() {
  const bars = [
    { h: 38, color: "#7A5FA8" },
    { h: 58, color: "#EF8060" },
    { h: 78, color: "#E7A94B" },
    { h: 98, color: "#E8462B" },
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
          gap: 12,
          paddingBottom: 40,
          backgroundColor: "#1F1830",
        }}
      >
        {bars.map((bar) => (
          <div
            key={bar.color}
            style={{ width: 18, height: bar.h, borderRadius: 9, backgroundColor: bar.color }}
          />
        ))}
      </div>
    ),
    size
  );
}
