/**
 * CAN-SPAM exige une adresse postale réelle. « ton adresse postale complète », valeur
 * d'exemple, est partie dans trois brouillons américains et le Contrôleur l'a validée,
 * parce qu'il ne vérifiait que sa longueur.
 */
export function adressePostaleValide(adresse: string): boolean {
  const a = adresse.trim();
  return a.length >= 15 && /\d/.test(a) && !/(ton|votre|your) adresse|adresse postale|your address|postal address|xxx|todo/i.test(a);
}
