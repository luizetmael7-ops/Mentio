# Le Prospecteur

Sous-système de prospection à coût nul. **Les dix modules sont écrits.** Il réutilise
la base Supabase et la logique de scan existante, et ne touche à rien du Baromètre
publié.

La chaîne tourne sur **GitHub Actions**, pas sur un VPS : l'ordonnanceur existait déjà
dans ce dépôt (l'Éditeur du Baromètre s'en sert), et son palier gratuit suffit
largement. Trois workflows dans `.github/workflows/prospecteur*.yml`.

> **Contrainte fondatrice : 0 €.** Aucun appel payant depuis ce répertoire, jamais.
> Un quota gratuit épuisé arrête le module et le journalise. Il n'escalade pas.

## État

| Module | Fichier | État |
|---|---|---|
| Le Semeur | `semeur.ts` | ✅ session 1 |
| Le Greffier | `greffier.ts` | ✅ session 1 |
| Le Facteur | `facteur.ts` | ✅ session 2 — **sans vérification SMTP**, voir ci-dessous |
| L'Angle | `angle.ts` | ✅ session 3 — lit le Baromètre publié, zéro appel LLM |
| La Plume | `plume.ts` | ✅ session 3 — quatre paragraphes, une seule phrase générée |
| Le Contrôleur | `controleur.ts` | ✅ session 3 — huit contrôles, droit de veto |
| L'Expéditeur | `expediteur.ts` | ✅ session 4 — trois verrous avant tout envoi |
| L'Oreille | `oreille.ts` | ✅ session 5 — IMAP, six catégories, brouillons |
| Le Directeur | `directeur.ts` | ✅ session 5 — bandit de Thompson, rapport du dimanche |
| L'Appariement | `appariement.ts` | ✅ session 5 — clients d'agence ↔ slugs du Baromètre |

Plus deux modules que le brief ne prévoyait pas :

| `importer-barometre.ts` | verse au vivier les marques déjà classées au Baromètre |
| `bilan.ts` | les chiffres, et les lignes à vérifier à la main |

## Mise en route

1. **Appliquer la migration** `supabase/migrations/20260815000005_prospection.sql`
   (quinze tables `prospect_*`, plus la boîte `seshat@mentio.fr` en semaine 1 de
   chauffe).
2. Vérifier les clés dans `.env.local` — voir « Les modèles gratuits » ci-dessous.
3. Lancer :

```bash
npm run prospect:semeur -- --plan     # montre le tirage du jour, aucun appel LLM
npm run prospect:semeur               # 10 questions
npm run prospect:greffier             # dédoublonne et résout les domaines
npm run prospect:bilan                # les chiffres + 20 lignes à vérifier
```

## Les modèles gratuits

Le registre vit dans `lib/free-llm.ts`. Un modèle sans sa clé est simplement
inactif ; il n'y a aucun repli payant.

| Clé `.env.local` | Modèle | Recherche web | Plafond par défaut |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Nemotron 3 (`:free`) | non | 35 appels/jour |
| `GEMINI_FREE_API_KEY` | Gemini Flash Lite (AI Studio) | non | 300 appels/jour |
| `MISTRAL_API_KEY` | Mistral Small | non | 200 appels/jour |

**Aucun modèle gratuit n'a la recherche web.** C'est une hypothèse du brief qui est
tombée : mesuré le 2026-08-15 sur une clé AI Studio neuve, le palier gratuit de
Google donne **zéro** quota de grounding — un appel avec `google_search` renvoie 429
`RESOURCE_EXHAUSTED` dès le premier essai, sur tous les modèles flash. Conséquences,
assumées : les relevés de prospection viennent de la mémoire des modèles et non
d'une recherche, et les domaines sources de l'angle n°3 devront venir du Baromètre
mesuré — qui tourne, lui, sur les modèles payants avec recherche. `GEMINI_FREE_SEARCH=1`
rouvre le robinet le jour où Google le rouvre.

**`GEMINI_FREE_API_KEY` n'est pas `GOOGLE_GENERATIVE_AI_API_KEY`.** La clé du
Baromètre vit sur un projet Google facturé, où chaque appel avec recherche est un
forfait à 0,0145 $. Réutiliser la mauvaise clé ferait payer la prospection sans que
rien ne le signale — d'où deux variables distinctes.

**Le plafond OpenRouter est partagé avec le juge du Baromètre.** Le palier gratuit
donne 50 requêtes/jour tant que le compte n'a jamais acheté de crédits (1000/jour
au-delà). Le plafond du Prospecteur est volontairement à 35 pour qu'une grosse
journée de prospection ne puisse pas tuer une édition hebdomadaire. Réglable par
`PROSPECT_CAP_OPENROUTER`.

## Les trois garanties du 0 €

Elles sont à trois niveaux différents, parce qu'une seule se contourne le jour où
un module est réécrit :

1. **Le registre** — `lib/free-llm.ts` refuse de démarrer si un id OpenRouter de la
   cascade ne finit pas par `:free`.
2. **Le quota en base** — chaque appel réserve un jeton via
   `prospect_reserve_quota()`. Plafond partagé entre modules parallèles.
3. **La clé étrangère** — `prospect_raw_scans.model` référence
   `prospect_free_models`, dont la colonne `is_free` porte un `check` toujours vrai.
   Un relevé issu d'un modèle payant ne peut pas être écrit.

Le juge suit la même règle : `judgeAnswerFree()` (dans `src/lib/llm/judge.ts`) est
la version sans filet payant de `judgeAnswer()`.

## Ce que la base garantit toute seule

Trois règles produit sont posées **en base**, pas dans le code :

- **Une question figée ne se modifie jamais** — un `update` de `prospect_questions.text`
  lève une exception. C'est CLAUDE.md §4 : la comparabilité entre éditions est le
  seul actif qu'un concurrent arrivé plus tard ne peut pas rattraper.
- **Une réponse brute non publiée expire à 90 jours** — `prospect_purge_raw_scans()`
  tourne au début de chaque Semeur. On stocke l'extraction et une empreinte, pas le
  texte : c'est ce qui fait tenir le palier gratuit Supabase (500 Mo) deux à trois
  ans au lieu d'un.
- **Une adresse devinée non vérifiée ne part jamais** — un `insert` dans
  `prospect_messages` visant un contact étiqueté `guessed_unverified` ou
  `catchall_guessed` lève une exception. Utile dès maintenant, alors que
  l'Expéditeur n'existe pas encore.

## Le Facteur sans port 25

Le brief prévoyait un handshake SMTP depuis un VPS OVH — c'est l'avantage qu'OVH
garde sur AWS, GCP et Azure, qui bloquent tous le port 25 sortant. **Il n'y a pas de
VPS**, et depuis une connexion résidentielle le port est bloqué par le FAI quand
l'IP n'est pas déjà sur les listes noires.

Les quatre étiquettes envoyables du brief supposaient toutes un « SMTP OK ». On n'a
pas gardé leurs noms en changeant leur sens : une étiquette qui ment sur ce qu'elle
prouve fait envoyer un email à une mauvaise adresse six mois plus tard, quand plus
personne ne se souvient du compromis.

| Étiquette | Ce qui est prouvé | Envoyable |
|---|---|---|
| `onsite_named` | adresse nominative **publiée par l'entreprise**, domaine avec MX | ✅ |
| `onsite_role` | `contact@` publiée par l'entreprise, domaine avec MX | ✅ avec « À l'attention de » |
| `pattern_unverified` | déduite du motif maison — c'est le SMTP qui la validait | ❌ |
| `guessed_unverified` | devinée | ❌ jamais |
| `no_mx` | lue sur le site, mais le domaine n'a aucun serveur mail | ❌ |
| `blocked` | `no-reply@`, `abuse@` : des boîtes qui refusent le courrier | ❌ |

Ce qu'on perd : on ne sait pas si la boîte existe, ni si le domaine est catch-all.
Ce qu'on garde : l'entreprise a **choisi de publier** cette adresse, ce qui reste le
signal le plus fort disponible, et le domaine sait recevoir du courrier (MX en DNS,
aucun port 25 nécessaire).

Le motif maison est collecté quand même. Il ne sert à rien aujourd'hui, il servira
le jour où un VPS apparaît — et il est gratuit à ramasser.

### Comment il trouve les pages

Deviner des chemins ne suffit pas, et c'est mesuré : `nutriandco.com` publie ses
pages sur `/fr/pages/mentions-legales`, `markal.fr` sur `/annexes/mentions-legales`.
Aucune liste ne trouve ça. Le Facteur lit donc la page d'accueil, **y récupère les
liens que le site désigne lui-même**, et ne retombe sur des chemins conventionnels
que si l'accueil n'en donne aucun. Total borné à 8 URL, robots.txt respecté,
2 requêtes/seconde, un seul passage.

L'ordre de priorité suit le rendement, pas l'intuition : mentions légales et page de
confidentialité d'abord. Le RGPD impose d'y publier un contact pour les demandes
d'accès, et sur une petite structure c'est souvent l'adresse du fondateur.

**Zéro appel LLM dans ce module.** Lire une page et reconnaître une adresse est du
code déterministe ; le faire passer par un modèle coûterait du quota pour ajouter du
hasard.

## La matrice

`config/matrix.ts` est l'unique variable d'entrée du système. Neuf couples
secteur × pays aujourd'hui, dont **trois qui découvrent des agences et non des
marques** : CLAUDE.md §1 dit que l'acheteur est l'agence, et une matrice qui ne
découvrirait que des marques rebâtirait le funnel qui a déjà échoué à 100 DM.

Le fichier fait foi pour l'existence des couples ; **la base fait foi pour les
poids**, que le Directeur déplace chaque dimanche. Le Semeur n'écrase jamais un
poids existant.

## Le cron (à installer en session 4, pas avant)

```cron
0 6 * * *  cd /srv/mentio && npx tsx scripts/prospection/semeur.ts   >> /var/log/mentio/semeur.log 2>&1
0 7 * * *  cd /srv/mentio && npx tsx scripts/prospection/greffier.ts >> /var/log/mentio/greffier.log 2>&1
```

Chaque exécution écrit aussi dans `prospect_log` : module, durée, statistiques,
erreur. C'est ce que le Directeur lira le dimanche, et c'est ce qui rend visible un
cron mort depuis trois semaines de cours.

## Vérifier à la main

`npm run prospect:bilan` sort 20 lignes au hasard. La colonne qui compte est
`DOMAINE` : ouvrir trois ou quatre sites au hasard et vérifier que c'est bien la
marque. Un `resolved` faux est le défaut le plus coûteux du système — il produit un
email argumenté envoyé à la mauvaise entreprise.

Les états possibles :

| État | Ce que ça veut dire |
|---|---|
| `resolved` | domaine proposé **et** vérifié : le nom est dans le `<title>` ou un `<h1>` |
| `rejected` | la page répond, mais elle ne parle pas de cette marque |
| `unresolved` | aucun domaine proposé, ou site injoignable |
| `pending` | pas encore passé au Greffier |
