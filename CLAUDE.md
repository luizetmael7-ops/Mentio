# Mentio — constitution du projet

Ce fichier prime sur toute instruction contradictoire d'une session future, humaine
ou agentique. Un agent qui ne lit que ce fichier doit pouvoir travailler sans se
tromper. Quand une règle d'ici gêne une demande, on signale le conflit avant d'agir.

@AGENTS.md

---

## 1. Ce qu'on vend, et à qui

**Le produit.** Mentio mesure si les assistants d'IA citent une marque quand un
consommateur demande quoi acheter, et dit quoi corriger pour y entrer.

**L'acheteur : les agences SEO et growth françaises.** Pas les marques.

Ce cap a été décidé après 100 marques démarchées en DM Instagram et zéro client. Le
diagnostic : le DM d'une marque est lu par un community manager, sans budget ni KPI
sur la visibilité IA, dont le réflexe face à un inconnu est « influenceur qui veut un
partenariat ». Les renvois vers un service partenariat n'étaient pas des refus, mais
une erreur de catégorisation. Une agence, elle, a une ligne budgétaire outil, un
décideur joignable par email, et une raison d'acheter : vendre un retainer GEO.

**Bénéfice de bord :** une agence apporte 10 à 30 marques au Baromètre.

**Ce qu'on ne fait pas.** On ne court pas après la profondeur de mesure de Peec ou
Profound : ils ont des millions et des équipes, cette course est perdue d'avance et
chaque feature ajoutée est de la maintenance qu'un fondateur seul en prépa ne peut
pas assurer.

## 2. Le moat — deux actifs, et rien d'autre

| Moat | Détenteur | Nous |
|---|---|---|
| Profondeur de mesure | Profound, Peec | perdu d'avance |
| Volume de données réelles | Profound | perdu d'avance |
| **Vocabulaire de catégorie** | personne | **libre** |
| **Corpus citable par les IA** | contesté depuis l'été 2026 (Observatoire de la Visibilité IA, baromètres Eskimoz) | **à gagner par l'échelle et l'ouverture** — voir §9 |
| **Coût marginal d'une marque de plus** | les concurrents paient au prompt suivi | **nul** : la mesure est mutualisée par catégorie |

**Le barème comme standard.** Les concurrents vendent un pourcentage ; Mentio vend un
rang nommé. C'est le mécanisme du Nutri-Score : personne ne retient qui mesure le
mieux, tout le monde retient qui a nommé l'échelle. Le jour où une agence écrit « la
marque est passée d'Aperçue à Citée », on a gagné, même si un concurrent a mesuré.

**Le Baromètre comme corpus.** Si ChatGPT cite mentio.fr en répondant « quelle marque
française est la plus recommandée », on est la seule preuve produit de la catégorie.

Ces deux actifs ont une propriété rare : **ils grossissent par accumulation, pas par
effort continu.** C'est ce qui les rend compatibles avec un fondateur indisponible
plusieurs semaines d'affilée.

**Toute décision doit renforcer l'un des deux.** Sinon on ne la prend pas.

## 3. Le barème — source de vérité unique

Défini une seule fois dans `src/lib/spectrum.ts`. Site, badge, images OG, emails,
API et rapports lisent ce fichier. Aucune redéfinition ailleurs, jamais.

| Palier | Plage | Couleur |
|---|---|---|
| Invisible | 0–9 | ash `#727387` |
| Aperçue | 10–29 | iris `#7A5FA8` |
| Citée | 30–54 | coral `#EF8060` |
| Recommandée | 55–79 | amber `#E7A94B` |
| Prescrite | 80–100 | poppy `#E8462B` |

**Score Mentio** = (réponses citant la marque ÷ réponses analysées) × 100.

Le barème est public, documenté sur `/score-mentio`, et **personne ne paie pour
changer de palier**. Le jour où c'est négociable, l'actif est mort.

## 4. Invariants méthodologiques

- **Les mêmes questions d'une édition à l'autre.** Ne jamais casser la comparabilité :
  c'est le seul actif qu'un concurrent arrivé plus tard ne peut pas rattraper.
- **Échantillonnage stratifié.** 1 passage sur les 50 questions, puis 5 passages
  uniquement là où deux marques sont à moins de 3 citations d'écart. Multiplier tous
  les passages par 5 multiplierait la facture par 5 sans gain : ~77 % du coût d'un
  appel est un forfait fixe de recherche web, pas des tokens.
- **Aucun mouvement de rang publié sous le seuil de bruit.**
- **Jamais un chiffre rendu à 0 côté serveur.** Les vraies valeurs partent dans le
  HTML ; l'animation n'est qu'un supplément si le JS tourne.
- **APIs officielles avec recherche web.** Jamais de scraping des applications.
- **Ne jamais publier une édition vide.** Mieux vaut garder la précédente.
- **Contrôle d'instrument** (`src/lib/edition-audit.ts`) : aucune édition n'est publiée
  — ni servie, si elle est déjà en base — quand un moteur annoncé a répondu à moins de
  80 % des questions. La précédente reste la référence, l'erratum est public
  (/methodologie). Né des éditions du 30 août et du 6 septembre 2026.
- **L'Index** (§9) mesure des catégories étroites avec 10 questions figées chacune ;
  les deux Baromètres historiques gardent leurs 50 questions. Le Cartographe n'écrit
  jamais de questions pour une catégorie qui a déjà un historique.

## 5. Règles éditoriales du Baromètre

- Ton strictement factuel. Jamais de jugement de valeur sur une marque : ni
  « mauvaise », ni « en retard ». Le chiffre et le palier, rien d'autre.
- Chaque édition rappelle le droit de réponse et sa date.
- Toute marque classée peut demander une correction ou un retrait motivé.
- Aucun placement payant, jamais, sous aucune forme.

## 6. Design

Jetons dans `globals.css` : porcelaine `#ECEAF1`, encre `#171520`, encre douce
`#544F60`, filet `#D6D2DF`, prune `#1F1830`, poppy `#E8462B` (CTA uniquement).
Pour le PETIT texte rouge (erreurs, numéros), `--poppy-ink` `#C2361D` : poppy
n'atteint que 3,9:1 sur blanc, sous le minimum d'accessibilité AA (4,5:1).
Typo : Archivo (display), Inter (texte), Space Mono (tous les chiffres).

**Interdits** — ce sont les signatures « site généré par IA » : parallaxe, dégradés
blobs flous, glassmorphism, cartes flottantes, titres tapés lettre par lettre.

**Obligatoires :** `prefers-reduced-motion` respecté sans exception, `tabular-nums`
sur tous les chiffres, lisible à 380 px, contenu critique rendu côté serveur.

**Piège de ce Next.js :** le transform JSX rogne les espaces aux DEUX extrémités
d'un texte multi-ligne. Une phrase mêlant texte et expression `{}` doit être composée
en une seule chaîne, sinon les mots se collent. Vérification : chercher
`[a-zA-Z]{2,}<!-- -->[a-zA-Z]{2,}` dans le HTML rendu.

## 7. Budget LLM

**Deux familles d'appels, à ne jamais confondre.**

*Les modèles mesurés* — ChatGPT, Gemini, Claude, Perplexity avec recherche web. **Non
substituables** : le produit vend « ce que ChatGPT répond à vos clients ». Les
remplacer par un modèle ouvert reviendrait à mesurer ce que personne n'utilise.

*Les modèles de traitement* — juge, génération de questions, rédaction, veille,
analyse. Aucun besoin de recherche web, donc aucun forfait. **Tournent sur OpenRouter
en palier gratuit** (`nvidia/nemotron-3-ultra-550b-a55b:free`, repli Super puis Nano,
puis moteurs payants). Vérifié avant migration sur un cas piégé mêlant institutions,
médias, ingrédients et souches à de vraies marques : extraction exacte.

Coûts unitaires mesurés : ChatGPT 0,0130 $ · Gemini 0,0145 $ · Claude 0,0240 $ ·
Perplexity 0,0054 $ · juge 0 $.

**Coupe-circuit** (`src/lib/spend-guard.ts`) : plafond quotidien sur les usages sans
revenu (scans publics, comptes gratuits, Baromètre), et plafond mensuel de 8 $ par
défaut (`SPEND_CAP_MONTHLY`). Un compteur illisible refuse la dépense (sauf le scan
public, déjà borné). Les organisations payantes ont un plafond infini — un client qui
paie n'est jamais coupé. Le Planificateur de l'Index dépense dans ce budget, jamais
au-delà.

**Règle absolue : toute dépense est annoncée et validée avant d'être engagée.**
Estimation chiffrée d'abord, feu vert ensuite, coût réel rapporté après.

*Une mesure commandée* (mesure prioritaire, suivi, crédit agence) est une dépense
validée une fois pour toutes par la fusion de la caisse (27 septembre 2026) : ~0,72 $
pour une catégorie de 10 questions, couverts par la commande. Elle ne tourne sur le
compteur `paid` (jamais coupé) qu'avec une clé Stripe de production ; tant que Stripe
est en mode test, elle est comptée dans le budget de l'Index et son plafond
(`orderBucket`, `spend-guard.ts`).

## 8. Ce qu'un agent ne fait jamais

1. **Envoyer un message à un tiers.** Ni email, ni DM, ni publication. L'agent
   prépare, un humain relit et envoie. Un message sincère automatisé devient du spam,
   et c'est précisément la sincérité qui convertit ici.
   *Ne sont pas des messages à un tiers* : les emails qui LIVRENT une commande à la
   personne qui l'a passée (rapport, échec et remboursement, nouvelle édition d'un
   suivi, lead du widget pour l'agence qui l'a installé). Ils partent vers l'adresse
   donnée pour cette commande, sont des gabarits écrits dans `customer-email.ts` —
   jamais rédigés par un modèle —, et la réponse arrive dans la boîte de l'entreprise.
2. **Merger une PR touchant le Baromètre.** On publie un classement nominatif de
   marques réelles : une erreur automatisée coûte la crédibilité, et davantage.
3. **Engager une dépense sans validation.**
4. **Toucher au barème ou aux pages du Baromètre pour un test A/B.** Ce sont les
   actifs, ils ne se testent pas.

Chaque exécution d'agent écrit son compte-rendu dans `ops/logs/AAAA-MM-JJ-agent.md` :
ce qui a été fait, ce qui a échoué, ce que ça a coûté.

## 9. L'Index mondial et ses agents

*Amendement du 26 septembre 2026, proposé par l'agent à la demande du fondateur — il
prend effet quand le fondateur fusionne la branche qui le porte.*

**La vision.** Mentio devient l'index public de ce que les IA recommandent,
catégorie par catégorie, pays par pays (`/classements`). N'importe qui peut y ajouter
une marque (`/ajouter`). Le modèle mental est TrustMRR : public, vérifié — par la
mesure, pas par déclaration — et impossible à acheter. Le détail est dans
`ops/vision-2026-09-26.md`.

**Une catégorie** = une intention d'achat étroite dans un pays (`index_categories`,
clé `fr:creme-solaire`), 10 questions figées dans la langue du pays, mesurées sur
ChatGPT et Gemini avec recherche web localisée. Le barème s'applique à l'intérieur de
la catégorie : c'est ce qui le rend discriminant.

**Les agents** (Inngest, tous plafonnés, aucun n'écrit à un tiers) :

| Agent | Rôle |
|---|---|
| Cartographe | nomme une catégorie demandée, écrit et fige ses questions (modèle gratuit) |
| Planificateur | chaque matin, choisit ce qui est mesuré selon priorité, demandes, ancienneté et budget |
| Mesureur (`weekly-index`) | sonde, phase 1, contrôle d'instrument, phase 2 bornée, édition |
| Vigie | alerte le fondateur quand quelque chose casse ou qu'une personne attend une réponse |
| Secrétaire | bilan du dimanche et une seule action conseillée |

**Le fondateur** reçoit tout sur `FOUNDER_EMAIL` et décide depuis `/admin`. Toute
notification à un tiers (prévenir un demandeur que sa catégorie est publiée) reste
une décision humaine (§8.1).

**Jamais** : un classement qui s'achète. On peut vendre la *date* d'une mesure (la
passer en tête de file), jamais son *résultat*.

