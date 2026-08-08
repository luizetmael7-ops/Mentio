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
| **Corpus citable par les IA** | personne | **libre** |

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

## 5. Règles éditoriales du Baromètre

- Ton strictement factuel. Jamais de jugement de valeur sur une marque : ni
  « mauvaise », ni « en retard ». Le chiffre et le palier, rien d'autre.
- Chaque édition rappelle le droit de réponse et sa date.
- Toute marque classée peut demander une correction ou un retrait motivé.
- Aucun placement payant, jamais, sous aucune forme.

## 6. Design

Jetons dans `globals.css` : porcelaine `#ECEAF1`, encre `#171520`, encre douce
`#544F60`, filet `#D6D2DF`, prune `#1F1830`, poppy `#E8462B` (CTA uniquement).
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
revenu (scans publics, comptes gratuits, Baromètre). Les organisations payantes ont un
plafond infini — un client qui paie n'est jamais coupé.

**Règle absolue : toute dépense est annoncée et validée avant d'être engagée.**
Estimation chiffrée d'abord, feu vert ensuite, coût réel rapporté après.

## 8. Ce qu'un agent ne fait jamais

1. **Envoyer un message à un tiers.** Ni email, ni DM, ni publication. L'agent
   prépare, un humain relit et envoie. Un message sincère automatisé devient du spam,
   et c'est précisément la sincérité qui convertit ici.
2. **Merger une PR touchant le Baromètre.** On publie un classement nominatif de
   marques réelles : une erreur automatisée coûte la crédibilité, et davantage.
3. **Engager une dépense sans validation.**
4. **Toucher au barème ou aux pages du Baromètre pour un test A/B.** Ce sont les
   actifs, ils ne se testent pas.

Chaque exécution d'agent écrit son compte-rendu dans `ops/logs/AAAA-MM-JJ-agent.md` :
ce qui a été fait, ce qui a échoué, ce que ça a coûté.
