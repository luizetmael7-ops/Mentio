import { Resend } from "resend";

let _resend: Resend | null = null;
export function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Mentio <onboarding@resend.dev>";

/**
 * Tant que le domaine n'est pas vérifié chez Resend, les envois ne partent que vers
 * l'adresse du compte. En dev on redirige tout vers EMAIL_DEV_OVERRIDE.
 */
export function deliverableTo(email: string): string {
  return process.env.EMAIL_DEV_OVERRIDE || email;
}
