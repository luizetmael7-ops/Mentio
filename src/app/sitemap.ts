import type { MetadataRoute } from "next";
import { getEditions, brandSlug } from "@/lib/index-edition";

const BASE = "https://mentio.fr";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const editions = await getEditions(12);
  const latest = editions[0];
  const lastModified = latest ? new Date(latest.date) : new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: BASE, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/barometre`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/score`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/en`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Une entrée par marque détectée, toutes éditions confondues
  const slugs = new Set<string>();
  for (const edition of editions) {
    for (const brand of edition.brands) slugs.add(brandSlug(brand.name));
  }
  const brands: MetadataRoute.Sitemap = [...slugs].map((slug) => ({
    url: `${BASE}/marques/${slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Les comparaisons du top 12 — mêmes paires que generateStaticParams de /vs/
  const top = (latest?.brands ?? []).slice(0, 12).map((b) => brandSlug(b.name));
  const versus: MetadataRoute.Sitemap = [];
  for (let i = 0; i < top.length; i += 1) {
    for (let j = i + 1; j < top.length; j += 1) {
      versus.push({
        url: `${BASE}/vs/${top[i]}-vs-${top[j]}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return [...fixed, ...brands, ...versus];
}
