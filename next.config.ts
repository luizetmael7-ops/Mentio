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
  async rewrites() {
    return [
      // Jumeaux Markdown : /marques/la-roche-posay.md — l'URL que les modèles devinent
      { source: "/marques/:slug.md", destination: "/marques/:slug/md" },
    ];
  },
};

export default nextConfig;
