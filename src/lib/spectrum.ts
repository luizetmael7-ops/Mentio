/**
 * L'échelle de visibilité Mentio — du cendré (invisible) au poppy (citée en tête).
 * Module neutre (ni client ni serveur) : le classement côté serveur et le relevé
 * côté client doivent partager exactement la même échelle.
 */
export const SPECTRUM = [
  { min: 85, color: "var(--spectrum-poppy)", label: "Top answer" },
  { min: 65, color: "var(--spectrum-amber)", label: "Well cited" },
  { min: 45, color: "var(--spectrum-coral)", label: "Cited" },
  { min: 20, color: "var(--spectrum-iris)", label: "Glimpsed" },
  { min: 0, color: "var(--spectrum-ash)", label: "Invisible" },
];

export function spectrumOf(value: number) {
  return SPECTRUM.find((s) => value >= s.min) ?? SPECTRUM[SPECTRUM.length - 1];
}
