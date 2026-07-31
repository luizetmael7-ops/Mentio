/**
 * LA question d'achat que les clients de CHAQUE marque tapent réellement.
 *
 * Pourquoi par marque et pas par grande catégorie : « quel café ou quelle boisson
 * choisir » partait au Petit Béret, qui fait du vin sans alcool. Une question
 * fausse détruit le message — le prospect voit tout de suite qu'on a envoyé du
 * générique. Ici chacun reçoit la question de SON rayon.
 *
 * Ces questions servent aussi de test que le prospect peut faire lui-même en
 * 30 secondes dans ChatGPT. C'est ça qui rend le message impactant : il vérifie,
 * il voit, il comprend. Aucune donnée inventée.
 */
export interface BrandContext {
  /** La question à coller dans ChatGPT — formulée comme un vrai client */
  question: string;
  /** Le rayon, en 2-4 mots, pour la phrase « personne n'a mesuré X » */
  rayon: string;
}

export const BRAND_CONTEXT: Record<string, BrandContext> = {
  // ── 4. Café, thé & boissons ────────────────────────────────────────────────
  "L'Arbre à Café": { question: "quelle marque de café de spécialité française commander en ligne ?", rayon: "le café de spécialité" },
  "Cafés Lomi": { question: "quelle marque de café de spécialité française commander en ligne ?", rayon: "le café de spécialité" },
  "Terres de Café": { question: "quelle marque de café de spécialité française commander en ligne ?", rayon: "le café de spécialité" },
  "Chic des Plantes": { question: "quelle marque française d'infusions bio choisir ?", rayon: "l'infusion bio" },
  "Karma Kombucha": { question: "quel kombucha français choisir ?", rayon: "le kombucha" },
  "Le Petit Béret": { question: "quel vin sans alcool choisir ?", rayon: "le vin sans alcool" },
  JNPR: { question: "quel spiritueux sans alcool pour faire un bon cocktail sans alcool ?", rayon: "les spiritueux sans alcool" },
  "French Bloom": { question: "quelle alternative sans alcool au champagne pour une fête ?", rayon: "les effervescents sans alcool" },

  // ── 5. Food, snacking & plant-based ────────────────────────────────────────
  Accro: { question: "quel snack protéiné vegan choisir ?", rayon: "le snacking protéiné vegan" },
  "Jimini's": { question: "quel snack riche en protéines et écologique choisir ?", rayon: "le snacking protéiné" },
  Poulehouse: { question: "quelle marque d'œufs éthiques acheter ?", rayon: "l'œuf éthique" },
  "Les Nouveaux Affineurs": { question: "quel fromage végétal français choisir ?", rayon: "le fromage végétal" },
  "Bene Bono": { question: "quel panier de fruits et légumes anti-gaspi se faire livrer ?", rayon: "le panier anti-gaspi" },
  Omie: { question: "quelle épicerie en ligne bio et engagée choisir ?", rayon: "l'épicerie en ligne engagée" },
  "Funky Veggie": { question: "quelle barre vegan sans sucre ajouté choisir ?", rayon: "la barre vegan" },
  HappyVore: { question: "quelle marque française de steak végétal choisir ?", rayon: "le steak végétal" },
  "Feed.": { question: "quel repas complet en poudre ou en barre choisir ?", rayon: "le repas complet" },

  // ── 6. Femtech, menstruel & wellness intime ────────────────────────────────
  Réjeanne: { question: "quelle culotte menstruelle française choisir ?", rayon: "la culotte menstruelle" },
  Fempo: { question: "quelle culotte menstruelle française choisir ?", rayon: "la culotte menstruelle" },
  "Elia Lingerie": { question: "quelle culotte menstruelle en coton bio choisir ?", rayon: "la culotte menstruelle" },
  Marguette: { question: "quelle culotte menstruelle pour ado choisir ?", rayon: "la culotte menstruelle" },
  Jho: { question: "quelles protections périodiques bio choisir ?", rayon: "les protections périodiques bio" },
  Gapianne: { question: "où acheter des produits de bien-être intime de qualité en France ?", rayon: "le bien-être intime" },

  // ── 7. Bébé & enfants ──────────────────────────────────────────────────────
  "Les Petits Culottés": { question: "quelles couches écologiques pour bébé choisir ?", rayon: "la couche écologique" },
  Joone: { question: "quelles couches saines pour bébé choisir ?", rayon: "la couche saine" },
  "Poudre Organic": { question: "quelle marque de vêtements bébé en coton bio choisir ?", rayon: "le vêtement bébé bio" },
  "Émoi Émoi": { question: "quel cadeau de naissance original offrir ?", rayon: "le cadeau de naissance" },
  "Louise Misha": { question: "quelle marque de vêtements pour enfant choisir ?", rayon: "la mode enfant" },

  // ── 8. Animaux (petfood DTC) ───────────────────────────────────────────────
  Ziggy: { question: "quelles croquettes saines pour chien choisir ?", rayon: "la croquette pour chien" },
  Japhy: { question: "quelles croquettes sur mesure pour chien choisir ?", rayon: "la croquette pour chien" },
  "Franklin Pet Food": { question: "quelles croquettes sans céréales pour chien choisir ?", rayon: "la croquette sans céréales" },
  Elmut: { question: "quelle marque de repas frais pour chien choisir ?", rayon: "l'alimentation fraîche pour chien" },
  Pepette: { question: "quelle alimentation fraîche pour chien ou chat choisir ?", rayon: "l'alimentation fraîche" },
  Caats: { question: "quelles croquettes sans céréales pour chat choisir ?", rayon: "la croquette pour chat" },

  // ── 9. Mode & accessoires ──────────────────────────────────────────────────
  "Jules & Jenn": { question: "quelle marque française de chaussures en cuir choisir ?", rayon: "la chaussure française" },
  Patine: { question: "quelles baskets made in France choisir ?", rayon: "la basket française" },
  Ector: { question: "quelles baskets recyclées fabriquées en France choisir ?", rayon: "la basket recyclée" },
  Panafrica: { question: "quelles baskets éthiques et colorées choisir ?", rayon: "la basket éthique" },
  "N'go": { question: "quelles baskets éthiques choisir ?", rayon: "la basket éthique" },
  Archiduchesse: { question: "quelle marque de chaussettes made in France choisir ?", rayon: "la chaussette française" },
  "Le Colonel Moutarde": { question: "où trouver un nœud papillon ou des bretelles originales ?", rayon: "l'accessoire homme" },
  "Olly Lingerie": { question: "quelle marque de lingerie française confortable choisir ?", rayon: "la lingerie française" },
  Ysé: { question: "quelle marque de lingerie pour petite poitrine choisir ?", rayon: "la lingerie" },
  Gemmyo: { question: "quelle joaillerie française pour une bague de fiançailles ?", rayon: "la joaillerie française" },
  "Le Gramme": { question: "quelle marque de bijoux minimalistes pour homme choisir ?", rayon: "le bijou minimaliste" },
  "Bonne Gueule": { question: "quelle marque de vêtements homme de qualité choisir ?", rayon: "la mode homme de qualité" },
  Asphalte: { question: "quelle marque de vêtements homme durables choisir ?", rayon: "la mode homme durable" },
  "Balzac Paris": { question: "quelle marque de vêtements femme française choisir ?", rayon: "la mode femme française" },
  Loom: { question: "quelle marque de vêtements durables et solides choisir ?", rayon: "le vêtement durable" },
  "1083": { question: "quel jean made in France choisir ?", rayon: "le jean français" },
  Faguo: { question: "quelle marque de mode française éco-responsable choisir ?", rayon: "la mode éco-responsable" },
  "Le Slip Français": { question: "quelle marque de sous-vêtements made in France choisir ?", rayon: "le sous-vêtement français" },

  // ── 10. Maison, sommeil & lifestyle ────────────────────────────────────────
  Kipli: { question: "quel matelas naturel en latex choisir ?", rayon: "le matelas naturel" },
  Tediber: { question: "quel matelas français choisir ?", rayon: "le matelas" },
  Morphée: { question: "comment s'endormir plus facilement sans écran ?", rayon: "les aides au sommeil" },
  Kerzon: { question: "quelle marque française de bougies parfumées naturelles choisir ?", rayon: "la bougie parfumée" },
};

/** Repli si une marque nouvelle n'a pas encore sa question sur mesure. */
export const FALLBACK_CONTEXT: Record<number, BrandContext> = {
  4: { question: "quelle boisson artisanale française choisir ?", rayon: "votre rayon" },
  5: { question: "quelle marque alimentaire française engagée choisir ?", rayon: "votre rayon" },
  6: { question: "quelle marque française de protections menstruelles choisir ?", rayon: "votre rayon" },
  7: { question: "quelle marque française pour bébé choisir ?", rayon: "votre rayon" },
  8: { question: "quelle marque d'alimentation pour animaux choisir ?", rayon: "votre rayon" },
  9: { question: "quelle marque de mode made in France choisir ?", rayon: "votre rayon" },
  10: { question: "quelle marque française pour la maison choisir ?", rayon: "votre rayon" },
};

export function contextFor(brand: string, categoryIndex: number): BrandContext {
  return (
    BRAND_CONTEXT[brand] ??
    FALLBACK_CONTEXT[categoryIndex] ?? {
      question: "quelle marque française choisir ?",
      rayon: "votre rayon",
    }
  );
}
