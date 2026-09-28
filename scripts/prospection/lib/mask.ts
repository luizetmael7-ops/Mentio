/**
 * Une adresse de tiers dans un journal PUBLIC.
 *
 * Le dépôt est public, et les journaux GitHub Actions d'un dépôt public se
 * lisent sans compte. Pendant un mois, le bilan, la Plume et l'Expéditeur y ont
 * imprimé en clair les adresses des personnes démarchées. En CI, on n'imprime
 * plus que l'initiale et le domaine (le domaine est celui du site de
 * l'entreprise, déjà public) ; en local, l'adresse entière, pour la relecture.
 */
export function shown(email: unknown): string {
  const value = String(email ?? "");
  if (process.env.GITHUB_ACTIONS !== "true") return value;
  const at = value.indexOf("@");
  return at > 0 ? `${value[0]}***${value.slice(at)}` : "***";
}
