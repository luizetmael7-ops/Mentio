import { supabaseAdmin } from "@/lib/supabase/admin";
import { fixturesEnabled } from "@/lib/fixtures";

/**
 * Une commande, telle que la voient la page de suivi et le rapport livré.
 *
 * L'identifiant de la commande (UUID v4, 122 bits d'aléa) est la clé d'accès :
 * il n'est connu que de l'acheteur (retour de Stripe, email de livraison). La
 * page n'affiche jamais son adresse, seulement la marque et l'avancement.
 */
export interface OrderView {
  id: string;
  kind: "priority" | "suivi" | "agency_credit";
  status: "pending" | "paid" | "measuring" | "delivered" | "failed" | "refunded" | "active" | "canceled";
  brandName: string;
  country: string;
  categoryInput: string;
  categoryKey: string | null;
  whiteLabel: { agence?: string; couleur?: string; logo?: string } | null;
  hasEmail: boolean;
  failureReason: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La commande de démonstration : même parcours, données de démonstration. */
export const DEMO_CATEGORY = "fr:creme-solaire";

export function demoOrder(brand: string, kind: OrderView["kind"] = "priority"): OrderView {
  return {
    id: "demo",
    kind,
    status: kind === "suivi" ? "active" : "delivered",
    brandName: brand.slice(0, 80) || "Votre marque",
    country: "FR",
    categoryInput: "Crème solaire",
    categoryKey: DEMO_CATEGORY,
    whiteLabel: null,
    hasEmail: true,
    failureReason: null,
    createdAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
  };
}

export async function getOrder(id: string): Promise<OrderView | null> {
  if (!UUID.test(id) || fixturesEnabled()) return null;
  const { data } = await supabaseAdmin()
    .from("orders")
    .select(
      "id, kind, status, brand_name, country, category_input, category_key, white_label, email, failure_reason, created_at, delivered_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    kind: data.kind,
    status: data.status,
    brandName: data.brand_name,
    country: data.country,
    categoryInput: data.category_input,
    categoryKey: data.category_key,
    whiteLabel: data.white_label,
    hasEmail: Boolean(data.email),
    failureReason: data.failure_reason,
    createdAt: data.created_at,
    deliveredAt: data.delivered_at,
  };
}
