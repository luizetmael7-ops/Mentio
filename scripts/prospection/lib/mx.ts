/**
 * LA SEULE VÉRIFICATION D'ADRESSE POSSIBLE SANS PORT 25.
 *
 * Le brief prévoyait un handshake SMTP depuis un VPS OVH (MX → 25 → HELO → MAIL
 * FROM → RCPT TO → QUIT, jamais de DATA). Il n'y a pas de VPS, et depuis une
 * connexion résidentielle le port 25 est bloqué par le FAI — quand il ne l'est pas,
 * l'IP est de toute façon sur toutes les listes noires.
 *
 * Reste la première étape de la cascade, celle qui ne demande que du DNS : le
 * domaine a-t-il un serveur de messagerie ? C'est une vérification faible — elle dit
 * que le domaine PEUT recevoir du courrier, pas que la boîte existe — mais elle
 * élimine pour de bon les domaines parqués et les sites vitrine sans email.
 *
 * Ce qu'on ne saura pas : si la boîte existe, et si le domaine est catch-all. C'est
 * exactement pour ça qu'une adresse déduite d'un motif reste non envoyable : sa
 * validation, c'était le SMTP.
 */
import { promises as dns } from "node:dns";

const cache = new Map<string, boolean>();

/** Le domaine peut-il recevoir du courrier ? */
export async function hasMx(domain: string): Promise<boolean> {
  const key = domain.toLowerCase();
  const known = cache.get(key);
  if (known !== undefined) return known;

  let ok = false;
  try {
    const records = await dns.resolveMx(key);
    ok = records.some((r) => Boolean(r.exchange));
  } catch {
    // Pas de MX : certains domaines reçoivent quand même du courrier via un A record
    // (RFC 5321 §5.1, repli implicite). C'est rare et vieux ; on ne parie pas dessus.
    ok = false;
  }

  cache.set(key, ok);
  return ok;
}
