---
name: barometre-editorial
description: Produire une édition du Baromètre Mentio — classement, commentaire, pages marques, corpus. À utiliser dès qu'une édition doit être rédigée, relue ou corrigée.
---

# Rédiger une édition du Baromètre Mentio

Ce fichier doit suffire. Un agent qui ne lit que lui doit pouvoir produire une
édition publiable sans rien demander.

## Ce qu'est une édition

Un classement daté des marques citées par les IA sur les questions d'achat d'un
secteur, accompagné d'un commentaire factuel. Elle est publiée sur `/barometre`,
génère une page par marque, et alimente le corpus lisible par les modèles.

**Ce n'est pas un article.** C'est un relevé. Le lecteur vient chercher un chiffre
sur une marque, pas une opinion.

## Le ton — la règle qui prime sur toutes les autres

Strictement factuel. Le chiffre et le palier, rien d'autre.

| Interdit | À la place |
|---|---|
| « X est à la traîne » | « X apparaît dans 3 réponses sur 100 » |
| « une performance décevante » | « 4 places perdues depuis l'édition précédente » |
| « la marque doit réagir » | rien — ce n'est pas notre rôle de le dire |
| « le grand gagnant » | « la marque la plus citée » |

Aucun superlatif, aucun jugement de valeur, aucun conseil adressé à une marque
classée. On publie des chiffres sur des entreprises qui ne nous ont rien demandé :
la sobriété est ce qui rend ça légitime.

Chaque édition rappelle le droit de réponse et l'adresse de contact.

## Les seuils de publication

1. **Jamais d'édition vide.** Si aucun run n'est exploitable, on garde la
   précédente. Une édition à zéro détruirait la crédibilité de toutes les autres.
2. **Aucun mouvement de rang publié sous le seuil de bruit.** Un déplacement n'est
   annoncé que si les intervalles de confiance des deux éditions ne se chevauchent
   pas. Sinon : « stable ».
3. **Les mêmes questions d'une édition à l'autre.** Ne jamais en modifier une seule
   sans décision explicite du fondateur. La comparabilité est le seul actif qu'un
   concurrent arrivé plus tard ne peut pas rattraper.
4. **Une marque qui bouge de plus de 10 places est vérifiée à la main** avant
   publication : c'est presque toujours un problème d'extraction (variante de nom,
   homonyme), pas un vrai mouvement.

## Le barème

Défini une seule fois dans `src/lib/spectrum.ts`. Ne jamais le redéfinir, ne jamais
en changer les seuils.

| Palier | Plage |
|---|---|
| Invisible | 0–9 |
| Aperçue | 10–29 |
| Citée | 30–54 |
| Recommandée | 55–79 |
| Prescrite | 80–100 |

Score Mentio = (réponses citant la marque ÷ réponses analysées) × 100.

## La structure du commentaire

Quatre paragraphes, jamais plus.

1. **Le fait principal.** Qui est en tête, avec combien de citations sur combien de
   réponses. Une phrase.
2. **Le mouvement.** Ce qui a changé depuis l'édition précédente, uniquement si
   c'est significatif. Si rien ne l'est, l'écrire : « aucun mouvement au-delà du
   bruit de mesure cette semaine. »
3. **Les sources.** Les deux ou trois domaines les plus lus par les modèles pour
   répondre. C'est l'information la plus actionnable de l'édition.
4. **La limite.** Une phrase qui rappelle ce que la mesure ne dit pas, et renvoie
   vers `/methodologie`.

## Le livrable

Une pull request contenant :

- l'édition en base (via le cron `weekly-index`, pas à la main) ;
- le commentaire éditorial ;
- la mise à jour de `llms.txt`, `llms-full.txt` et `barometre.md` ;
- un compte-rendu dans `ops/logs/AAAA-MM-JJ-editeur.md` : ce qui a été fait, ce qui
  a échoué, le coût en dollars.

**L'agent n'a jamais le droit de merger cette PR.** On publie un classement
nominatif de marques réelles ; une erreur automatisée coûte la crédibilité du
Baromètre, et potentiellement davantage.

## Les coûts

Une édition tourne autour de 2,50 $ en échantillonnage stratifié (une passe sur les
50 questions, puis quatre passes de plus sur au maximum 12 questions disputées).

Le juge et la génération de questions tournent sur OpenRouter en palier gratuit.
Les modèles mesurés — ChatGPT, Gemini, Claude, Perplexity avec recherche web — ne
sont **jamais** substituables : le produit vend « ce que ChatGPT répond à vos
clients ».

Si le coupe-circuit (`src/lib/spend-guard.ts`) refuse l'exécution, l'agent
s'arrête, l'écrit dans son log, et ne contourne jamais le plafond.
