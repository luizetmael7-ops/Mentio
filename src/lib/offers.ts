/**
 * CE QUI SE VEND — une seule définition, lue par la grille, les pages et Stripe.
 *
 * Quatre offres, et pas une de plus :
 *   · l'Index, gratuit : consulter, ajouter une marque, scanner ;
 *   · la mesure prioritaire, 49 € une fois : sa catégorie mesurée maintenant et
 *     le rapport complet livré par email, sans attendre la file publique ;
 *   · le suivi, 19 €/mois : la catégorie remesurée chaque mois, et un email
 *     quand le palier bouge ;
 *   · l'agence, 149 €/mois : dix mesures prioritaires par mois, la marque
 *     blanche, et le widget qui capte des prospects sur son propre site.
 *
 * LA RÈGLE QUI NE SE VEND PAS : on paie la DATE d'une mesure, jamais son
 * RÉSULTAT. Une mesure payée suit exactement la méthode publique ; elle peut
 * dire « absente », et c'est ce qu'elle dira si c'est vrai (constitution §3).
 *
 * Les prix sont passés à Stripe en `price_data` : aucun prix à créer à la main
 * dans le tableau de bord Stripe, rien qui puisse diverger d'ici.
 */
export const RULE_DATE_NOT_RESULT =
  "Vous payez la date de la mesure, jamais son résultat : elle suit exactement la méthode publique et peut conclure que la marque est absente.";

export const OFFERS = {
  index: {
    label: "L'Index",
    priceEur: 0,
    cadence: "gratuit",
    pitch: "Consulter les classements, ajouter une marque à la file, lancer un scan en direct.",
    features: [
      "Tous les classements, catégorie par catégorie",
      "Ajouter une marque ou une catégorie à la file",
      "Scan gratuit en 60 secondes",
      "Le badge de votre palier, libre d'usage",
    ],
  },
  priority: {
    label: "Mesure prioritaire",
    priceEur: 49,
    cadence: "une fois",
    pitch: "Votre catégorie mesurée maintenant, et le rapport complet dans votre boîte en moins d'une heure.",
    features: [
      "Mesure lancée dès le paiement, sans file d'attente",
      "Rapport complet : score, rang, concurrents, questions perdues, sources, plan d'action",
      "Aux couleurs de votre agence si vous le souhaitez",
      "Remboursé si un moteur ne répond pas",
    ],
  },
  suivi: {
    label: "Suivi",
    priceEur: 19,
    cadence: "par mois",
    pitch: "Votre catégorie remesurée chaque mois, et un email quand votre palier bouge.",
    features: [
      "Remesure mensuelle garantie",
      "Alerte de palier : vous savez le jour où vous passez d'Aperçue à Citée",
      "Le rapport complet mis à jour",
      "Sans engagement",
    ],
  },
  agency: {
    label: "Agence",
    priceEur: 149,
    cadence: "par mois",
    includedPriority: 10,
    pitch: "Un aimant à prospects sur votre site, et dix mesures prioritaires par mois pour signer.",
    features: [
      "10 mesures prioritaires par mois, pour vos clients et vos prospects",
      "Rapports à vos couleurs, envoyables par lien",
      "Le widget : un scan de visibilité IA sur votre site, les leads arrivent chez vous",
      "Vos leads et vos mesures dans un seul espace",
    ],
  },
} as const;

export type OfferKey = keyof typeof OFFERS;

/**
 * Une édition de moins de N jours est livrée telle quelle à qui commande une
 * mesure prioritaire : elle est fraîche, la remesurer ne dirait rien de plus.
 */
export const FRESH_DAYS = 3;

/** Le montant en centimes, pour Stripe. */
export function amountCents(offer: "priority" | "suivi"): number {
  return OFFERS[offer].priceEur * 100;
}
