# 2026-08-19 — Le Prospecteur, session 1 (Le Semeur + Le Greffier)

## Ce qui a été fait

- **Migration** `supabase/migrations/20260815000005_prospection.sql` — 15 tables
  `prospect_*`, préfixées parce que `public.brands` porte déjà les marques
  *clientes* : deux populations, deux tables, aucune confusion possible. RLS activée
  partout, aucune policy — service role uniquement, ces tables portent des adresses
  email de tiers.
- **Trois règles produit posées en base**, pas dans le code : question figée
  (trigger sur `update`), expiration des réponses brutes à 90 jours + fonction de
  purge, adresse devinée non envoyable (trigger sur `insert` de message).
- **`scripts/prospection/lib/free-llm.ts`** — la seule porte de sortie LLM du
  sous-système. Registre gratuit uniquement, réservation de quota en base
  (`prospect_reserve_quota`), arrêt sans escalade payante. Garde-fou au chargement :
  un id OpenRouter sans `:free` fait planter le module.
- **`src/lib/llm/judge.ts`** — ajout de `judgeAnswerFree()`, version sans filet
  payant de `judgeAnswer()`. Le juge du Baromètre garde son repli OpenAI/Claude
  (une édition ratée coûte plus cher que quelques centimes) ; le Prospecteur, non.
- **`semeur.ts`** — matrice secteur × pays × langue, génération puis gel des 10
  questions par couple, tirage pondéré du jour, relevé stocké sans réponse brute
  (empreinte SHA-256 seulement).
- **`greffier.ts`** — normalisation et suffixes juridiques, table d'alias,
  dédoublonnage en mémoire, résolution de domaine par proposition **puis**
  vérification HTTP (`<title>` / `<h1>`), qualification, exclusions.
- **`bilan.ts`** — les chiffres de la session + 20 lignes tirées au hasard.
- `README.md` du sous-système, entrées `npm run prospect:*`, `.env.example` complété.

`npx tsc --noEmit` et `npx eslint scripts/prospection` passent tous les deux.

## L'exécution — 3 secteurs × 3 pays

Migration appliquée à la main dans l'éditeur SQL du dashboard (la CLI n'est pas
connectée sur cette machine, et `supabase login` est interactif). Les 15 tables, les
4 fonctions et les 3 triggers sont passés du premier coup.

| | |
|---|---|
| Questions figées | **90** (9 couples × 10, aucun doublon) |
| Questions scannées | 8, sur 2 modèles |
| Relevés | 16 · **75 mentions** |
| Marques uniques | **62**, dont 1 exclue (Rapunzel, DE) → vivier net 61 |
| Domaines résolus | **33 / 62 — 53 %** après audit (cible du brief : 55–65 %) |
| Quota | OpenRouter 31/35 · Gemini 17/300 |
| Coût réel | **0,00 $** |

Composition des 27 non-résolus, qui est plus intéressante que le taux :

- **10 bloqués par un pare-feu (403)** — Vichy, Solgar, Seed, NOW Foods, Metagenics,
  Simple, Youth to the People, Hépar, Contrex. Sites bien vivants, domaine
  probablement juste, mais invérifiable : le système refuse, ce qui est le
  comportement voulu.
- **12 injoignables** — surtout des micro-producteurs de spiruline dont le modèle a
  inventé le domaine. Signature de l'hallucination : à la seconde tentative il a
  proposé un domaine *différent* pour la même marque. Sans vérification HTTP,
  c'étaient douze emails à personne, ou à quelqu'un d'autre.
- **4 nom absent de la page** — dont `forcapi.com`, un domaine parqué (« Launching
  Soon »). Vrai rejet.
- **1 sans proposition** — « Spiruline de », un fragment tronqué par le juge.

## Trois défauts trouvés en faisant tourner, et corrigés

1. **User-Agent bloqué.** `MentioBot/1.0 (+url)` recevait 403 sur la moitié des gros
   sites. Passé à la forme conventionnelle des robots légitimes,
   `Mozilla/5.0 (compatible; MentioBot/1.0; +https://mentio.fr/contact)` — toujours
   aussi identifiable, mais reconnue par les pare-feux. +4 domaines immédiatement.
2. **Entités HTML non décodées.** `Nature&#39;s Way` normalisé donnait
   `nature39sway`, qui ne correspondait plus à `naturesway`. Trois des quatre
   premiers rejets venaient de là. Sur un corpus franco-anglais où l'apostrophe est
   partout (L'Oréal, Paula's Choice), c'était une fuite permanente. +3 domaines.
3. **Fragments pris pour des marques.** « Spiruline de » passait le filtre de forme.
   Un nom qui se termine par une préposition est une phrase coupée : rejeté.

4. **Un homonyme résolu à tort.** « Vegalia », marque de compléments française, a
   été résolue vers `vegalia.com` — « Vegalia TI », une société de services
   informatiques espagnole. Le nom était bien dans le `<title>` : la règle du brief
   était satisfaite, et le domaine était faux. C'est le défaut structurel des noms
   courts, portés par plusieurs entreprises dans plusieurs pays.

   Remède : une **seconde condition**, le site doit parler du secteur où la marque a
   été découverte (`config/secteurs.ts`, une liste de mots, aucun modèle). Calibrage
   à deux tours — la première version cherchait dans le texte visible des 200
   premiers Ko, qui sur les gros sites ne contiennent que du CSS inline : elle a
   déclassé à tort Luxéol, Phyto, Paula's Choice et Designs for Health. La version
   retenue cherche dans tout le HTML privé de ses scripts, sur 400 Ko.

   Résultat de l'audit final : **33 confirmés, 2 déclassés** — Vegalia (vrai
   positif attrapé) et Rapunzel (site en allemand, pas de vocabulaire allemand dans
   les listes ; marque déjà exclue sur le pays, donc sans conséquence).

Ajoutés au passage, tous deux gratuits en quota :
- `--retry` reprend les échecs de résolution ;
- `--audit` rejoue la vérification HTTP sur les domaines déjà résolus, **sans aucun
  appel LLM**. C'est ce qui rattrape un domaine revendu, un site refait, ou une
  règle qu'on vient de durcir. À passer une fois par semaine.

Un déclassement conserve désormais le domaine en base (seul `domain_status =
'resolved'` autorise l'aval à s'en servir) : sans ça, durcir une règle obligeait à
racheter au modèle une proposition qu'on avait déjà.

## Une hypothèse du brief qui tombe

**Le palier gratuit de Google ne donne plus de recherche web.** Mesuré sur une clé
AI Studio neuve, projet sans facturation : un appel avec `google_search` renvoie 429
`RESOURCE_EXHAUSTED` dès le premier essai, sur tous les modèles flash. Le brief
comptait dessus pour capter les domaines sources.

Conséquences : les relevés de prospection viennent de la mémoire des modèles, pas
d'une recherche ; l'angle n°3 (« domaine à conquérir ») devra tirer ses domaines du
Baromètre mesuré, qui tourne sur les modèles payants avec recherche. Ce n'est pas
une perte sèche — c'est même plus solide, puisque cette donnée-là est mesurée.

Autre observation utile pour la session 3 : sur les questions « agence », Nemotron a
renvoyé **0 marque sur 3 questions sur 4**, là où Gemini en a sorti 5 à chaque fois.
Sur la population qui est l'ICP, les deux modèles gratuits ne se valent pas.

## Conflits signalés

1. **CLAUDE.md §1 vs le brief du Prospecteur.** Le brief construit un funnel qui
   découvre des *marques* à partir de questions d'achat consommateur ; la §1 dit que
   l'acheteur est l'agence, pas la marque (100 marques démarchées, zéro client).
   Résolution appliquée : la matrice comporte un secteur `agences_geo_seo` avec
   `target = 'agency'`, et la colonne `target` existe jusque dans `prospect_brands`.
   Les marques restent découvertes — elles sont le corpus et la preuve qu'on vend à
   l'agence — mais elles ne sont plus la seule population.
2. **Palier gratuit OpenRouter.** Le compte n'a jamais acheté de crédits
   (`is_free_tier: true`, usage 0) : 50 requêtes/jour sur les modèles `:free`,
   partagées avec le juge du Baromètre. Le plafond du Prospecteur est fixé à 35 pour
   qu'une journée de prospection ne puisse pas tuer une édition. Aucune dépense
   engagée ni proposée sans validation (§7).

## À reprendre en session 2

- **Stocker le domaine proposé, même quand la vérification échoue.** Aujourd'hui la
  proposition est perdue, donc chaque reprise redemande au modèle ce qu'on savait
  déjà. La vérification HTTP est gratuite, la proposition ne l'est pas : une colonne
  `domain_proposed` rendrait `--retry` gratuit. À faire passer avec la migration du
  Facteur, pour ne pas demander un second copier-coller de SQL.
- **Les 403 vont revenir, et ils comptent davantage.** Le Facteur crawle 8 URL par
  domaine ; les pare-feux qui bloquent la page d'accueil bloqueront le reste.
- **Le tirage est déséquilibré à court terme** : 42 des 62 marques viennent des
  compléments alimentaires, parce que 8 questions tirées au hasard sur 90 ne
  couvrent pas les neuf couples. Sur un cycle complet à 10/jour, ça s'égalise — ne
  pas corriger les poids sur cette base.
