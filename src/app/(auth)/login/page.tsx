import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
