import { categoryBySlug } from "@/lib/index-catalog";
import { categoryImage } from "@/lib/og/category-image";

export const alt = "Classement de l'Index Mentio — ce que ChatGPT et Gemini recommandent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OgImage({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  return categoryImage(await categoryBySlug(vertical), size);
}
