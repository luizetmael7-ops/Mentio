import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Créer un compte — Mentio",
  description: "Créez votre compte Mentio et suivez chaque semaine si les IA citent votre marque.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
