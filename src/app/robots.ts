import type { MetadataRoute } from "next";

/**
 * Les crawlers d'IA sont explicitement bienvenus : tout l'intérêt du Baromètre
 * est d'être lu et cité par les modèles. Seules les zones privées sont fermées.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/settings/", "/onboarding", "/api/", "/auth/"],
      },
    ],
    sitemap: "https://mentio.fr/sitemap.xml",
    host: "https://mentio.fr",
  };
}
