# 2026-08-19 — Le Prospecteur, session 3 (L'Angle, La Plume, Le Contrôleur)

## Le virage de la session

Le brief fait découvrir les prospects par le Semeur. En vérifiant la dépendance du
Contrôleur — `/rapport/[slug]` doit répondre 200 — il est apparu que cette page se
construit depuis `index_editions`, les éditions **publiées** du Baromètre. Sur les 61
marques découvertes par le Semeur, **8 seulement** y figuraient : les 53 autres
n'auraient jamais pu recevoir d'email, quelle que soit la qualité de leur adresse.

À l'inverse, le Baromètre classait déjà 93 marques dont **43 agences** — c'est-à-dire
l'acheteur défini en §1, mesuré, nommé, avec une page de rapport publique. C'était la
meilleure liste de prospects du projet, et elle existait avant le Semeur.

`importer-barometre.ts` la verse au vivier. Le Semeur garde son rôle — il alimente le
corpus et repère les marques à mesurer un jour — mais il n'est plus la seule source.

Ça règle au passage le conflit signalé en session 2 : l'angle « palier » ne vient
jamais d'un scan de prospection. Tout l'Angle lit le Baromètre, donc une vraie mesure
avec recherche web, donc un vrai Score Mentio (§3).

## Résultats

| | |
|---|---|
| Marques importées du Baromètre | 81 nouvelles (93 − 8 déjà connues − 4 non-marques) |
| Domaines résolus | **63 %** sur ces 81 — meilleur que les 53 % du Semeur |
| Adresses envoyables | **65 au total** (30 session 2 + 35 nouvelles) |
| Angles calculés | **31**, dont 28 dépassements nommés et 3 questions perdues |
| **Niveau 1 ou 2** | **100 %** — le brief en exige 80 % |
| Emails rédigés | 31 · 0 trop long · 0 variable manquante |
| **Validés par le Contrôleur** | **27** · 4 rejetés (**13 %**, seuil d'alerte à 40 %) |
| Coût | **0,00 $** |

Les 4 rejets sont des marques américaines : CAN-SPAM impose une adresse postale dans
le message, `PROSPECT_POSTAL_ADDRESS` n'est pas renseignée, le Contrôleur refuse. Le
comportement est correct — c'est une donnée à fournir, pas un bug.

## Le certificat TLS de mentio.fr

Découvert parce que l'Angle a refusé les 46 premiers prospects d'affilée.

**`https://mentio.fr` sert un certificat `cluster129.hosting.ovh.net`.** Tout
navigateur affiche un avertissement de sécurité pleine page. `https://www.mentio.fr`
fonctionne, certificat valide, rapports servis normalement.

Conséquences au-delà de la prospection : l'apex est le domaine qui porte le produit,
et le Baromètre est censé être citable par les IA — c'est le moat n°2. À corriger
côté OVH ; aucune modification de zone DNS n'a été faite par l'agent.

Contournement en place : `PROSPECT_REPORT_BASE=https://www.mentio.fr`.

## Cinq défauts trouvés en exécutant

1. **Gabarit qui dépasse la donnée.** « C'est {concurrent} qu'il lit, *pas vous* »
   alors que la marque est citée 2 fois. Le contrôle de FAIT l'a refusé sur 19
   emails. Corrigé en réécrivant deux lignes de gabarit — exactement ce que le brief
   annonce comme réflexe correct.
2. **429 par minute pris pour un quota journalier.** Gemini limite à 15 requêtes par
   minute ; le code posait le drapeau `exhausted_at`, qui bloquait ensuite tout le
   projet pour la journée alors que 34 appels sur 300 avaient été consommés. La
   cadence est passée à 4,5 s et le 429 « PerMinute » déclenche une pause, pas un
   arrêt. Le message d'erreur distingue désormais les deux causes.
3. **Doublons dans la file.** Deux exécutions de La Plume écrivaient deux emails au
   même contact ; le contrôle DOUBLON ne regarde que les messages *envoyés*. Une
   garde a été ajoutée à la rédaction.
4. **Contrôle légal trop littéral.** Il cherchait la phrase exacte du gabarit :
   raccourcir la provenance de trois mots a fait échouer les 31 emails d'un coup,
   alors que l'information légale était toujours là. Il cherche maintenant
   l'obligation, pas la formulation.
5. **Prompt de vérification trop strict.** Il traitait `concurrent` (le plus cité au
   total) et `gagnant_question` (celui qui sort sur une question précise) comme
   contradictoires. Ce sont deux faits distincts. Le taux de rejet est passé de 65 %
   à 13 % après correction.

## Ce qui reste à toi

1. **Relire le CSV** — `ops/emails-a-relire.csv`, 27 emails validés. C'est la session
   où tu ne peux pas tricher : elle calibre le gabarit pour tous les suivants.
2. **Réécrire `content/prospection-fr.md`.** Un agent l'a initialisé pour que la
   chaîne tourne ; les mots qui partent à de vraies personnes se choisissent à la main.
3. **Renseigner `PROSPECT_POSTAL_ADDRESS`** si tu veux ouvrir les États-Unis.
4. **Corriger le certificat de l'apex `mentio.fr`.**

## Écart assumé

Le brief demandait 100 emails en CSV. Il y en a 27, et c'est la bonne quantité : le
vivier actionnable est borné par le nombre de marques à la fois classées au Baromètre
et joignables. Forcer 100 aurait exigé de descendre dans la qualité des angles — ce
que le brief interdit explicitement (« le quota est l'ennemi de la personnalisation »).
