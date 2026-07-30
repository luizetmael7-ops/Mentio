import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Ancienne URL française de la page tarifs
      { source: "/tarifs", destination: "/pricing", permanent: true },
      // L'Index vivait à /index — ce segment est traité comme la page par défaut
      // d'un dossier et écrasait la racine du site. Il vit désormais à /barometre.
      { source: "/index", destination: "/barometre", permanent: true },
    ];
  },
};

export default nextConfig;
