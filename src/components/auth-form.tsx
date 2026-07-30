"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

const COPY = {
  login: {
    eyebrow: "Connexion",
    title: ["Reprenons", "votre relevé"],
    lead: "Accédez au suivi de votre visibilité dans les réponses d'IA.",
    submit: "Se connecter",
    swapText: "Pas encore de compte ?",
    swapLink: "Créer un compte",
    swapHref: "/signup",
  },
  signup: {
    eyebrow: "Créer un compte",
    title: ["Mesurez", "votre visibilité"],
    lead: "Suivi hebdomadaire de votre marque dans les réponses d'IA. Gratuit, sans carte bancaire.",
    submit: "Créer mon compte",
    swapText: "Vous avez déjà un compte ?",
    swapLink: "Se connecter",
    swapHref: "/login",
  },
} as const;

/** Messages d'erreur Supabase traduits — l'anglais brut fait amateur. */
function frenchError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) {
    return "Votre adresse n'est pas encore confirmée : cliquez sur le lien reçu par email.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Un compte existe déjà avec cette adresse. Connectez-vous plutôt.";
  }
  if (m.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  }
  if (m.includes("unable to validate email")) return "Cette adresse email n'est pas valide.";
  return "Une erreur est survenue. Réessayez, ou écrivez-nous depuis la page contact.";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = COPY[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(frenchError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md rounded-3xl border-2 border-[var(--jade)] bg-white p-8">
        <MailCheck aria-hidden className="size-7 text-[var(--jade)]" />
        <h2 className="mt-4 font-display text-xl font-extrabold uppercase tracking-wide">
          Vérifiez votre boîte mail
        </h2>
        <p className="mt-3 text-[var(--ink-soft)]">
          {`Un lien de confirmation vient de partir vers ${email}. Cliquez dessus pour activer votre compte — le lien est valable une heure.`}
        </p>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          Rien reçu au bout de deux minutes ? Regardez dans les indésirables, ou{" "}
          <Link href="/contact" className="underline">
            signalez-le nous
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl">
        {t.title[0]}
        <br />
        <span className="text-[var(--poppy)]">{t.title[1]}</span>
      </h1>
      <p className="mt-4 text-[var(--ink-soft)]">{t.lead}</p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-3xl border border-[var(--line)] bg-white p-7"
      >
        <div>
          <label htmlFor="auth-email" className="eyebrow mb-1.5 block !text-[0.65rem]">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@votremarque.fr"
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="eyebrow mb-1.5 block !text-[0.65rem]">
            Mot de passe
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "8 caractères minimum" : ""}
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--porcelain)]/50 px-4 outline-none"
          />
        </div>

        {error && <p className="text-sm text-[var(--poppy)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--poppy)] font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? "…" : t.submit}
          {!loading && <ArrowRight aria-hidden className="size-4" />}
        </button>

        <p className="text-center text-sm text-[var(--ink-soft)]">
          {t.swapText}{" "}
          <Link className="font-medium text-[var(--ink)] underline" href={t.swapHref}>
            {t.swapLink}
          </Link>
        </p>
      </form>

      {mode === "signup" && (
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--ink-soft)]">
          En créant un compte, vous acceptez les{" "}
          <Link href="/terms" className="underline">
            CGU
          </Link>{" "}
          et la{" "}
          <Link href="/privacy" className="underline">
            politique de confidentialité
          </Link>
          .
        </p>
      )}
    </div>
  );
}
