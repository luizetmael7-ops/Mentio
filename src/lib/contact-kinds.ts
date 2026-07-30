/**
 * Les motifs de contact. Module ordinaire, PAS « use server » : un fichier
 * d'actions serveur ne peut exporter que des fonctions asynchrones, et un
 * tableau importé depuis un composant client y devient une référence serveur
 * inutilisable (le build échouait au prérendu de /contact).
 */
export const CONTACT_KINDS = [
  {
    value: "correction",
    label: "Corriger une donnée sur ma marque",
    hint: "Droit de réponse : un chiffre du classement vous paraît faux ou incomplet.",
  },
  {
    value: "reclamation",
    label: "Réclamation",
    hint: "Un problème avec le produit, la facturation, ou un désaccord à signaler.",
  },
  {
    value: "feedback",
    label: "Retour d'expérience",
    hint: "Ce qui manque, ce qui cloche, ce qui pourrait être meilleur.",
  },
  { value: "presse", label: "Presse ou étude", hint: "Reprise des données, interview, chiffres." },
  { value: "autre", label: "Autre", hint: "" },
] as const;

export type ContactKind = (typeof CONTACT_KINDS)[number]["value"];
