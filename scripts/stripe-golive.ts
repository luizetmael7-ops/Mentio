/**
 * Passage de Stripe en LIVE, en une commande.
 *
 * Fait tout ce qui peut être fait par API :
 *   1. vérifie que le compte est réellement activé pour encaisser
 *   2. crée (idempotent) les 3 produits et leurs 6 prix, mensuel + annuel
 *   3. crée (idempotent) le webhook vers mentio.fr avec les bons événements
 *   4. affiche les variables d'environnement exactes à poser sur Vercel
 *
 * La clé live n'est jamais écrite sur disque : passez-la en argument.
 *
 *   npx tsx scripts/stripe-golive.ts --key=sk_live_xxx
 *   npx tsx scripts/stripe-golive.ts --key=sk_live_xxx --dry-run
 */
import Stripe from "stripe";
import { PLAN_LIMITS, type Plan } from "../src/lib/plans";

const PAID_PLANS: Plan[] = ["starter", "growth", "agency"];
const WEBHOOK_URL = "https://mentio.fr/api/stripe/webhook";
// Exactement les événements traités par app/api/stripe/webhook/route.ts
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

function arg(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found?.split("=").slice(1).join("=");
}

const DRY = process.argv.includes("--dry-run");

async function main() {
  const key = arg("key") ?? process.env.STRIPE_LIVE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Clé manquante. Usage : npx tsx scripts/stripe-golive.ts --key=sk_live_xxx"
    );
  }
  const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";
  const stripe = new Stripe(key);

  console.log(`\n=== Stripe ${mode} ===`);
  if (DRY) console.log("(simulation : rien ne sera créé)\n");

  // 1. Le compte peut-il encaisser ?
  // Appel direct : selon la version du SDK, accounts.retrieve() exige un id.
  const account = (await (
    await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
    })
  ).json()) as {
    id: string;
    country: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    error?: { message: string };
  };
  if (account.error) throw new Error(`Stripe : ${account.error.message}`);
  console.log(`Compte    : ${account.id} (${account.country})`);
  console.log(`Paiements : ${account.charges_enabled ? "activés" : "NON ACTIVÉS"}`);
  console.log(`Virements : ${account.payouts_enabled ? "activés" : "NON ACTIVÉS"}`);

  if (mode === "LIVE" && !account.charges_enabled) {
    console.log(
      "\n⚠️  Le compte n'est pas encore autorisé à encaisser. Les produits peuvent être créés,\n" +
        "    mais aucun paiement ne passera. Vérifiez la validation d'identité dans le dashboard."
    );
  }

  // 2. Produits et prix
  console.log("\n--- Produits et prix ---");
  const created: string[] = [];
  for (const plan of PAID_PLANS) {
    const limits = PLAN_LIMITS[plan];
    const monthlyKey = `mentio_${plan}_monthly`;
    const yearlyKey = `mentio_${plan}_yearly`;

    const { data: existing } = await stripe.prices.list({ lookup_keys: [monthlyKey], limit: 1 });
    if (existing.length > 0) {
      const price = existing[0];
      const expected = limits.priceMonthlyEur * 100;
      const match = price.unit_amount === expected;
      console.log(
        `✓ ${plan.padEnd(8)} existe (${price.id})` +
          (match ? "" : ` — ⚠️ prix Stripe ${price.unit_amount! / 100} € ≠ plans.ts ${limits.priceMonthlyEur} €`)
      );
      continue;
    }

    if (DRY) {
      console.log(`→ ${plan.padEnd(8)} à créer : ${limits.priceMonthlyEur} €/mois et ${limits.priceMonthlyEur * 10} €/an`);
      continue;
    }

    const product = await stripe.products.create({
      name: `Mentio ${limits.label}`,
      description: `${limits.brands} marque(s) · ${limits.promptsPerBrand} questions/marque · ${limits.cadenceLabel}`,
      metadata: { plan },
    });
    const monthly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: limits.priceMonthlyEur * 100,
      recurring: { interval: "month" },
      lookup_key: monthlyKey,
      metadata: { plan },
    });
    const yearly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: limits.priceMonthlyEur * 10 * 100, // 10 mois payés = 2 offerts
      recurring: { interval: "year" },
      lookup_key: yearlyKey,
      metadata: { plan },
    });
    console.log(`✅ ${plan.padEnd(8)} créé : ${monthly.id} (mensuel) · ${yearly.id} (annuel)`);
    created.push(plan);
  }

  // 3. Webhook
  console.log("\n--- Webhook ---");
  const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 100 });
  const existingHook = endpoints.find((e) => e.url === WEBHOOK_URL);
  let secret: string | undefined;

  if (existingHook) {
    const missing = WEBHOOK_EVENTS.filter((e) => !existingHook.enabled_events.includes(e));
    console.log(`✓ Webhook existe (${existingHook.id}, statut ${existingHook.status})`);
    if (missing.length > 0) {
      if (DRY) {
        console.log(`→ événements à ajouter : ${missing.join(", ")}`);
      } else {
        await stripe.webhookEndpoints.update(existingHook.id, {
          enabled_events: [...new Set([...existingHook.enabled_events, ...WEBHOOK_EVENTS])] as
            Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
        });
        console.log(`✅ événements ajoutés : ${missing.join(", ")}`);
      }
    }
    console.log(
      "   Le secret de signature n'est visible qu'à la création. S'il vous manque,\n" +
        "   supprimez ce webhook dans le dashboard et relancez ce script."
    );
  } else if (DRY) {
    console.log(`→ webhook à créer : ${WEBHOOK_URL} (${WEBHOOK_EVENTS.join(", ")})`);
  } else {
    const hook = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: WEBHOOK_EVENTS,
      description: "Mentio — abonnements",
    });
    secret = hook.secret;
    console.log(`✅ Webhook créé : ${hook.id}`);
  }

  // 4. Ce qu'il reste à poser
  console.log("\n--- Variables d'environnement à mettre sur Vercel (Production) ---");
  console.log(`STRIPE_SECRET_KEY=${key.slice(0, 12)}…  (la clé passée à ce script)`);
  console.log("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…  (dashboard Stripe → Clés API)");
  if (secret) {
    console.log(`STRIPE_WEBHOOK_SECRET=${secret}`);
    console.log("\n☝️  Ce secret ne sera plus jamais affiché. Copiez-le maintenant.");
  } else {
    console.log("STRIPE_WEBHOOK_SECRET=whsec_…  (inchangé si le webhook existait déjà)");
  }
  console.log("\nPuis redéployez : npx vercel deploy --prod --yes\n");
}

main().catch((e) => {
  console.error("\n❌", e.message ?? e, "\n");
  process.exit(1);
});
