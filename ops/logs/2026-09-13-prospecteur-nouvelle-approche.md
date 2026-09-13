# 2026-09-13 — Le Prospecteur, nouvelle approche : agences seulement, France d'abord, étranger ensuite

Suite du Kaizen du même jour. Feu vert : « on reste sur le budget zéro, on tente la
nouvelle approche, on cible aussi hors France, toute proposition doit apprendre ».

## Ce qui a été fait

1. **La phrase de méthode est calculée, plus jamais écrite de mémoire.** `{methode}` lit
   les moteurs réellement interrogés, la recherche web, le marché et la date dans
   l'angle. Fin de l'affirmation fausse « ChatGPT, Gemini, Claude et Perplexity ».
2. **Agences hors France.** Aucune édition ne couvre leur marché : leur comptage vient
   des questions du Semeur pour ce pays, **Gemini seul** (Nemotron sert à extraire,
   personne ne lui demande quelle agence choisir, §7), minimum 10 réponses. L'email le
   dit tel quel et précise qu'aucune édition ne couvre encore ce marché.
3. **« Bonne nouvelle + badge » pour les agences classées dans la moitié haute**, en
   concurrence avec l'angle « dépassement nommé » via le bandit (`chooseAngle`).
4. **La Plume ne rédige plus que pour la cible** (agences, pays ouverts). Avant, seul
   l'Expéditeur filtrait : 20 des 33 brouillons étaient pour des marques.
5. **Contrôle d'identité des agences** (`lib/agence.ts`, zéro LLM) : le métier doit être
   dans le titre ou la description du site ; un logiciel parle d'essai gratuit, une
   boutique de panier. Audit du vivier : **82 « agences » sur 200 n'en étaient pas**
   (Moz, Yoast, Wix, WordPress, React, Jasper, Semji, Oxeva, Reech…). Exclusions
   réversibles, motif `pas_une_agence: …`. Faux négatifs connus et acceptés : Jellyfish,
   Brainlabs, Merkle, iCrossing, Semetis — de grands réseaux, hors cible.
6. **Gabarits de relevé réécrits** : la phrase chiffrée est dans le gabarit, plus
   d'ouverture générée. Les mêmes nombres apparaissaient trois fois par email.

## Ce que la relecture a arrêté

Lecture intégrale de chaque brouillon avant validation. Aucun ne serait parti en l'état :

| Défaut | Emails touchés | Correction |
|---|---|---|
| Adresse postale d'exemple « ton adresse postale complète » dans les emails US, **validée par le Contrôleur** | 4 | adresse réelle exigée, et présente dans le corps |
| « Bonjour Société », « Bonjour France », « Bonjour Agence », « Bonjour International » | 5 | prénom écrit seulement si l'adresse le confirme (maxence@ → Maxence) |
| « Bonjour » en tête d'emails anglais | 4 | « Hello » |
| « 10 questions a founder asks when looking for an agency » envoyé à des marques de cosmétique | 20 | phrase selon la cible des questions (arrêté par FAIT) |
| Mêmes chiffres trois fois, « Gemini Free », « sur 10 questions » pour un compte de réponses | tous | gabarits déterministes |
| Date « 2026-08-13 » dans une phrase française | 5 | « 13 août 2026 » |
| La chaîne GitHub ne transmettait pas `PROSPECT_POSTAL_ADDRESS` | — | ajoutée |

Faux positif corrigé : le contrôle `NIVEAU` cherchait le palier « Citée » sans casse et
bloquait le verbe « n'est citée dans aucune ».

## Ce qui ne marche pas comme prévu

**La bonne nouvelle ne peut pas partir par email.** Les 20 agences françaises classées
ont toutes reçu le premier email en août. La règle des 180 jours l'interdit, et l'Oreille
ne lit pas la boîte : une relance automatique pourrait tomber sur quelqu'un qui a dit non.
→ `ops/agences-classees-linkedin.md` : les 10 de la moitié haute, un message court à
envoyer à la main, qui corrige d'abord l'erreur des quatre moteurs.

**Les États-Unis sont bloqués** tant que le secret `PROSPECT_POSTAL_ADDRESS` ne contient
pas une vraie adresse postale. C'est voulu : CAN-SPAM.

## État de la file ce soir

5 emails validés, tous à des agences françaises confirmées, lus en entier : SteerFox,
My Little Big Web, Kwantic, SeoMix, SEO Hackers. 4 agences américaines prêtes dès que
l'adresse postale existe (Ignite Visibility, Siege Media, Seer Interactive, Orainti).

Le vivier réel est petit : une fois les non-agences retirées et les 20 déjà contactées
mises de côté, il reste peu d'agences joignables sans email récent. Le débit dépend
maintenant du Semeur et du Facteur, pas de l'Expéditeur.

## Coût

0,00 $. Quota gratuit consommé : OpenRouter 14/35, Gemini ~150/300.
