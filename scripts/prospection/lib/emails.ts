/**
 * EXTRACTION ET ÉTIQUETAGE DES ADRESSES.
 *
 * Une adresse n'a de valeur que par ce qu'on peut prouver à son sujet. Sans port 25,
 * on ne peut plus prouver qu'une boîte existe — on peut seulement prouver que
 * l'entreprise l'a publiée elle-même, et que son domaine sait recevoir du courrier.
 * Tout le reste de ce fichier découle de ça : on lit, on classe, on ne devine pas.
 *
 * Les 200 caractères de contexte ne sont pas décoratifs. Ce sont eux qui distinguent
 * « écrivez à Marie Dupont — marie@… » d'une adresse de pied de page, et ce sont eux
 * qu'on relit à la main quand un contact paraît douteux.
 */
import { decodeEntities } from "./domain";

export type ContactKind = "named" | "role" | "blocked";

export interface FoundEmail {
  email: string;
  local: string;
  domain: string;
  kind: ContactKind;
  role?: string;
  firstName?: string;
  lastName?: string;
  context: string;
  sourceUrl: string;
}

/**
 * Adresses qui refusent le courrier par construction. Écrire à `no-reply@` ne
 * produit rien, et écrire à `abuse@` ou `postmaster@` produit pire que rien : ce
 * sont les boîtes qui déclenchent les signalements.
 */
const BLOCKED_LOCALS = new Set([
  // Boîtes qui ne lisent rien
  "no-reply", "noreply", "no_reply", "donotreply", "do-not-reply", "ne-pas-repondre",
  "nepasrepondre", "mailer-daemon", "postmaster", "hostmaster", "abuse", "bounce",
  "bounces", "notification", "notifications", "newsletter", "news", "unsubscribe",
  "desabonnement", "automated", "auto", "robot", "noc", "security", "ssl-admin",

  // Boîtes juridiques et RGPD. Le brief a raison de dire que la page de
  // confidentialité rend beaucoup — mais ce qu'on y cherche, c'est l'adresse
  // PERSONNELLE qu'une petite structure y publie, pas la boîte du DPO. Envoyer une
  // offre commerciale à `dpo@` est le moyen le plus rapide de récolter une plainte
  // RGPD, et à 0,05 % de plainte le domaine d'envoi s'arrête.
  "dpo", "privacy", "privacyoffice", "rgpd", "gdpr", "legal", "juridique",
  "donneespersonnelles", "cil", "compliance",

  // Mauvais interlocuteurs : ni décideurs, ni acheteurs, et prompts à signaler.
  "presse", "press", "media", "medias", "pressoffice", "testimonials", "temoignages",
  "jobs", "job", "emploi", "recrutement", "careers", "career", "rh", "hr", "cv",
  "compta", "comptabilite", "accounting", "billing", "facturation", "invoice",
]);

/** Boîtes de fonction : envoyables, mais on écrit « à l'attention de » quelqu'un. */
const ROLE_LOCALS = new Set([
  "contact", "contacts", "contactez-nous", "info", "infos", "information", "hello",
  "bonjour", "hi", "hey", "team", "equipe", "service", "serviceclient", "clients",
  "client", "sav", "support", "aide", "help", "customercare", "customerservice",
  "commercial", "sales", "vente", "ventes", "business", "partenariat", "partenariats",
  "partnership", "partners", "connect", "admin", "webmaster", "office", "bureau",
  "accueil", "welcome", "mentions", "devis", "reservation", "booking", "boutique",
  "shop", "commandes", "commande", "order", "orders", "studio", "direction",
]);

/**
 * Adresses d'exemple, laissées dans les formulaires et les gabarits.
 * Relevé sur les 33 premiers domaines : `name@mail.com` sur vsl3.com,
 * `john@coolbusiness.com` sur riseatseven.com. Elles passent tous les filtres de
 * forme — ce sont des adresses parfaitement valides — et n'appartiennent à personne.
 */
const PLACEHOLDER_LOCALS = new Set([
  "name", "nom", "prenom", "firstname", "lastname", "yourname", "votrenom",
  "email", "mail", "youremail", "votreemail", "adresse", "address", "exemple",
  "example", "test", "demo", "sample", "john", "jane", "johndoe", "jeandupont",
  "utilisateur", "user", "username", "moi", "me", "someone", "abc", "xyz",
]);

const PLACEHOLDER_DOMAINS = new Set([
  "mail.com", "email.com", "example.com", "example.org", "exemple.fr", "domain.com",
  "domaine.fr", "yourdomain.com", "votredomaine.fr", "test.com", "demo.com",
  "coolbusiness.com", "company.com", "entreprise.fr", "site.com", "monsite.fr",
]);

/** Les messageries grand public : sur une TPE, c'est souvent la vraie boîte du dirigeant. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com",
  "hotmail.fr", "live.fr", "msn.com", "yahoo.com", "yahoo.fr", "orange.fr",
  "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net", "bbox.fr", "numericable.fr",
  "aol.com", "icloud.com", "me.com", "protonmail.com", "proton.me", "gmx.com",
]);

/**
 * Domaines qui appartiennent à des outils, pas à l'entreprise. On les voit partout
 * dans le HTML des sites e-commerce : ce sont des adresses techniques d'éditeurs.
 */
const VENDOR_DOMAINS = [
  "sentry.io", "wixpress.com", "wix.com", "shopify.com", "squarespace.com",
  "godaddy.com", "example.com", "example.org", "domain.com", "yourdomain.com",
  "email.com", "sentry-next.wixpress.com", "cloudflare.com", "w3.org", "schema.org",
  "google.com", "facebook.com", "gstatic.com", "jquery.com", "adobe.com",
  "wordpress.org", "wordpress.com", "elementor.com", "prestashop.com",
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,24}/g;

/** Fichiers et faux positifs qui ressemblent à une adresse dans du HTML minifié. */
function isNoise(email: string): boolean {
  const lower = email.toLowerCase();
  if (/\.(png|jpe?g|gif|svg|webp|avif|bmp|tiff?|css|js|mjs|map|json|xml|txt|woff2?|ttf|eot|ico|mp[34]|webm|pdf|zip)$/.test(lower)) return true;
  // Les images responsives ressemblent à s'y méprendre à des adresses :
  // `salesforce_png@320w.avif`, `logo@2x.png`. Une page en contenait 72.
  if (/@\d+(x|w|h)[.-]/.test(lower)) return true;
  if (VENDOR_DOMAINS.some((d) => lower.endsWith(`@${d}`) || lower.endsWith(`.${d}`))) return true;
  if (lower.length > 70) return true;
  if (/^[0-9a-f]{16,}@/.test(lower)) return true;             // empreintes, pas des gens

  const [local, domain] = lower.split("@");
  if (PLACEHOLDER_DOMAINS.has(domain)) return true;
  if (PLACEHOLDER_LOCALS.has(local.replace(/[._-]/g, ""))) return true;
  return false;
}

/**
 * Nettoie les séquences d'échappement JSON collées à l'adresse.
 * Relevé sur thorne.com : le HTML contient `>privacy@thorne.com`, et l'adresse
 * ressortait sous la forme `u003eprivacy@thorne.com`. Une adresse valide en
 * apparence, inexistante en réalité.
 */
function unescapeJson(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Le texte lisible d'une page, tags et scripts retirés, entités décodées. */
export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  ).replace(/[ \t ]+/g, " ");
}

const NAME_IN_CONTEXT =
  /\b([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{1,15})\s+([A-ZÀ-ÖØ-Þ][A-Za-zà-öø-ÿ'’-]{1,20})\b/;

/** Suffixes de langue ou de marché collés à une boîte de fonction : `support-fr`, `info.uk`. */
const LOCALE_SUFFIX = /^(fr|en|uk|us|de|es|it|be|ch|ca|nl|eu|int|www|web|team)$/i;

function classify(local: string, context = ""): { kind: ContactKind; role?: string } {
  const key = local.toLowerCase();
  if (BLOCKED_LOCALS.has(key)) return { kind: "blocked" };
  if (ROLE_LOCALS.has(key)) return { kind: "role", role: key };

  const parts = key.split(/[._-]/).filter(Boolean);

  // Une boîte de fonction déclinée par marché reste une boîte de fonction.
  // `support-fr@` passait pour un nom de personne au premier passage.
  if (parts.length === 2 && (ROLE_LOCALS.has(parts[0]) || BLOCKED_LOCALS.has(parts[0]))) {
    if (LOCALE_SUFFIX.test(parts[1]) || ROLE_LOCALS.has(parts[1])) {
      return BLOCKED_LOCALS.has(parts[0]) ? { kind: "blocked" } : { kind: "role", role: parts[0] };
    }
  }

  // Prénom + nom : la forme la moins ambiguë.
  if (/^[a-zà-ÿ]{2,15}[._-][a-zà-ÿ'-]{2,20}$/i.test(key)) return { kind: "named" };
  if (/^[a-zà-ÿ]\.[a-zà-ÿ'-]{2,20}$/i.test(key)) return { kind: "named" };

  // Un seul mot : nominatif seulement si la page l'écrit comme un prénom, avec sa
  // majuscule. `guillaume@reech.com` sur une page qui dit « Guillaume » est une
  // personne ; `studio@` sur une page qui ne dit rien est une boîte. Sans cette
  // preuve, on reste sur « fonction » — écrire « Bonjour Studio » est pire que
  // n'écrire aucun prénom.
  if (/^[a-zà-ÿ]{3,14}$/i.test(key)) {
    const capitalized = new RegExp(`\\b${key.charAt(0).toUpperCase()}${key.slice(1)}\\b`);
    if (capitalized.test(context)) return { kind: "named" };
  }

  return { kind: "role", role: key };
}

function namesFromLocal(local: string): { firstName?: string; lastName?: string } {
  const parts = local.toLowerCase().split(/[._-]/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length === 2 && parts[0].length > 1) return { firstName: cap(parts[0]), lastName: cap(parts[1]) };
  if (parts.length === 2) return { lastName: cap(parts[1]) };           // « p.dupont »
  if (parts.length === 1 && parts[0].length > 2) return { firstName: cap(parts[0]) };
  return {};
}

/**
 * Le format d'une adresse nominative, pour en déduire le motif maison.
 * On ne s'en sert pas pour envoyer — une adresse déduite n'est pas vérifiable sans
 * SMTP — mais c'est gratuit à collecter et immédiatement utile le jour où ça change.
 */
export function patternOf(local: string): string | null {
  const key = local.toLowerCase();
  if (/^[a-z]{2,}\.[a-z'-]{2,}$/.test(key)) return "prenom.nom";
  if (/^[a-z]\.[a-z'-]{2,}$/.test(key)) return "p.nom";
  if (/^[a-z]{2,}-[a-z'-]{2,}$/.test(key)) return "prenom-nom";
  if (/^[a-z]{2,}_[a-z'-]{2,}$/.test(key)) return "prenom_nom";
  if (/^[a-z]{3,15}$/.test(key)) return "prenom";
  return null;
}

/**
 * Toutes les adresses d'une page, dédoublonnées, avec leur contexte.
 * Deux sources : les `mailto:` du HTML (les plus sûres, et présentes dans 40 % des
 * pieds de page) et le texte lisible.
 */
export function extractEmails(html: string, sourceUrl: string): FoundEmail[] {
  const found = new Map<string, FoundEmail>();
  const text = visibleText(html);

  const record = (raw: string, context: string) => {
    const email = decodeEntities(raw).trim().toLowerCase().replace(/[.,;:)\]]+$/, "");
    if (!email.includes("@") || isNoise(email)) return;
    const [local, domain] = email.split("@");
    if (!local || !domain) return;
    if (found.has(email)) return;

    const { kind, role } = classify(local, context);
    const fromLocal = kind === "named" ? namesFromLocal(local) : {};
    let { firstName, lastName } = fromLocal;

    // Pour une boîte de fonction, un nom humain dans les 200 caractères alentour
    // vaut mieux que rien : c'est ce qui permet le « À l'attention de Marie ».
    if (!firstName) {
      const match = NAME_IN_CONTEXT.exec(context);
      if (match) {
        firstName = match[1];
        lastName = match[2];
      }
    }

    found.set(email, { email, local, domain, kind, role, firstName, lastName, context: context.trim().slice(0, 200), sourceUrl });
  };

  // 1. les mailto: — la source la plus sûre, et présente dans 40 % des pieds de page
  const mailtoRe = /mailto:([^"'>\s?]+)/gi;
  for (let m = mailtoRe.exec(html); m; m = mailtoRe.exec(html)) {
    const around = visibleText(html.slice(Math.max(0, m.index - 400), m.index + 400)).slice(0, 200);
    record(m[1], around);
  }

  // 2. le texte lisible — celui qu'un humain verrait
  for (let m = EMAIL_RE.exec(text); m; m = EMAIL_RE.exec(text)) {
    const start = Math.max(0, m.index - 100);
    record(m[0], text.slice(start, m.index + m[0].length + 100));
  }
  EMAIL_RE.lastIndex = 0;

  // 3. le HTML brut, scripts compris.
  //
  // C'est la passe qui rapporte le plus, et elle a failli ne pas exister. Sur les
  // sites Shopify et sur les thèmes à configuration inline, l'adresse de contact
  // vit dans un objet JSON à l'intérieur d'un <script> : `contact@luxeol.com`,
  // `bonjour@nutriandco.com` étaient invisibles aux deux passes précédentes.
  //
  // Chercher dans le brut ramasse aussi du bruit — `salesforce@320w.png` et 71
  // autres noms de fichiers sur une seule page. C'est le filtre `isNoise` qui fait
  // le tri, et c'est le bon endroit pour ça : une extension d'image se reconnaît
  // sans ambiguïté, une adresse dans un JSON, non.
  const raw = unescapeJson(decodeEntities(html));
  for (let m = EMAIL_RE.exec(raw); m; m = EMAIL_RE.exec(raw)) {
    const start = Math.max(0, m.index - 200);
    const around = visibleText(raw.slice(start, m.index + m[0].length + 200));
    record(m[0], around);
  }
  EMAIL_RE.lastIndex = 0;

  return [...found.values()];
}

/**
 * Le motif maison : une SEULE adresse nominative trouvée sur le domaine ⇒ son format
 * devient le motif. Deux formats différents ⇒ aucun motif, parce qu'on déduirait au
 * hasard. On déduit, on ne devine pas.
 */
/**
 * Écarte les adresses qui ne sont pas celles de l'entreprise.
 *
 * Le site de Markal publie `contact@creasens.fr` : c'est son agence web. Écrire là
 * revient à démarcher un prestataire au sujet de la visibilité de son client — au
 * mieux inutile, au pire signalé comme spam.
 *
 * La règle n'est pas « même domaine, point ». Beaucoup de très petites structures
 * n'ont pas d'adresse à leur nom et publient un Gmail, qui est leur vraie boîte.
 *
 * Mais le repli « on garde tout le reste » était trop large : le site de Nature's Way
 * a rendu `info@stagheaddesigns.com`, une entreprise sans aucun rapport. Donc, à
 * défaut d'adresse au domaine de la marque, on ne garde que deux cas défendables :
 * une messagerie grand public, ou un domaine qui porte le nom de la marque
 * (`vsl3usa.com` pour VSL#3). Tout le reste est le prestataire de quelqu'un d'autre.
 */
export function keepOwnAddresses(emails: FoundEmail[], brandDomain: string, brandName = ""): FoundEmail[] {
  const apex = brandDomain.replace(/^www\./, "");
  const own = emails.filter((e) => e.domain === apex || e.domain.endsWith(`.${apex}`));
  if (own.length > 0) return own;

  // Les jetons du nom et du domaine, pour reconnaître une variante (vsl3 → vsl3usa).
  const tokens = [...brandName.toLowerCase().split(/[^a-z0-9]+/), apex.split(".")[0]]
    .filter((t) => t.length >= 4);

  return emails.filter((e) => {
    if (FREE_MAIL_DOMAINS.has(e.domain)) return true;
    const label = e.domain.split(".")[0];
    return tokens.some((t) => label.includes(t) || t.includes(label));
  });
}

export function housePattern(emails: FoundEmail[], brandDomain: string): string | null {
  const named = emails.filter((e) => e.kind === "named" && e.domain === brandDomain);
  const patterns = new Set(named.map((e) => patternOf(e.local)).filter(Boolean) as string[]);
  return patterns.size === 1 ? [...patterns][0] : null;
}
