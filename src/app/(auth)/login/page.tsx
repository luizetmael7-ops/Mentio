import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Connexion — Mentio",
  description: "Accédez au suivi de la visibilité de votre marque dans les réponses d'IA.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
