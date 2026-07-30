import type { Metadata } from "next";
import Link from "next/link";
import { BrandNav } from "@/components/brand/nav";
import { BrandFooter } from "@/components/brand/footer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unsubscribeToken } from "@/lib/newsletter-token";

export const metadata: Metadata = {
  title: "Désinscription — Mentio",
  robots: { index: false, follow: false },
};

/**
 * Désinscription en un clic, sans confirmation à cliquer : le lien de l'email
 * contient un jeton qui prouve qu'il s'adresse bien à cette adresse.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; t?: string }>;
}) {
  const { email, t } = await searchParams;
  let message = "Lien de désinscription invalide ou incomplet.";

  if (email && t && t === unsubscribeToken(email)) {
    try {
      const { error } = await supabaseAdmin()
        .from("newsletter_subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("email", email.toLowerCase());
      message = error
        ? "Désinscription impossible pour le moment. Écrivez-moi à hello@mentio.fr."
        : `C'est fait : ${email} ne recevra plus le Baromètre.`;
    } catch {
      message = "Désinscription impossible pour le moment. Écrivez-moi à hello@mentio.fr.";
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--porcelain)] text-[var(--ink)]">
      <BrandNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-32">
        <p className="eyebrow">Newsletter</p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight">
          Désinscription
        </h1>
        <p className="mt-4 text-[var(--ink-soft)]">{message}</p>
        <Link href="/barometre" className="mt-6 inline-block underline">
          Le Baromètre reste consultable librement →
        </Link>
      </main>
      <BrandFooter />
    </div>
  );
}
