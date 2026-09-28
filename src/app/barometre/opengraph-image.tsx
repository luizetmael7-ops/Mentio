import { categoryByKey } from "@/lib/index-catalog";
import { DEFAULT_VERTICAL } from "@/lib/index-edition";
import { categoryImage } from "@/lib/og/category-image";

export const alt = "Le Baromètre Mentio — les marques que ChatGPT et Gemini recommandent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OgImage() {
  return categoryImage(await categoryByKey(DEFAULT_VERTICAL), size);
}
