# Modèles ouverts et coûts — la réponse que je te devais

Tu as proposé trois fois d'étudier Kimi, GLM, l'open source ou les agrégateurs pour
baisser les coûts. Je ne l'avais pas traité. Voici l'analyse, chiffres de notre base
à l'appui.

## D'où vient réellement l'argent dépensé

Coût moyen par appel, mesuré sur nos 260 appels enregistrés :

| Modèle | $ / appel |
|---|---|
| ChatGPT | 0,0130 |
| Gemini | 0,0145 |
| Claude | 0,0240 |
| Perplexity | 0,0054 |
| **Juge** (extraction des marques) | **0,0010** |

Le point décisif : sur les 0,013 $ d'un appel ChatGPT, **environ 0,010 $ est un
forfait fixe facturé pour l'outil de recherche web**, pas des tokens. Raccourcir les
prompts ou changer pour un modèle « moins cher au token » ne change donc quasiment
rien. Ce qui coûte, c'est le **nombre d'appels avec recherche web**.

## Pourquoi on ne peut PAS remplacer les modèles mesurés

Mentio vend une phrase : « voici ce que ChatGPT répond à vos clients ». Si on mesure
Kimi ou GLM à la place, on mesure des modèles que personne n'utilise en France pour
choisir une crème solaire. Le chiffre devient faux et le produit perd sa raison d'être.

**Le runner reste donc sur les vrais modèles grand public. Ce n'est pas négociable.**

## Où les modèles ouverts feraient gagner de l'argent

Deux briques ne mesurent rien : elles traitent du texte. Elles n'ont pas besoin de
recherche web, donc pas du forfait qui coûte cher.

**1. Le juge** — il lit une réponse et en extrait les marques citées, leur position
et le ton. C'est de l'extraction structurée, la tâche typique où un modèle ouvert
récent fait aussi bien qu'un modèle propriétaire.

**2. Le générateur de questions** — il écrit 10 questions d'achat pour un secteur.
Un appel par scan.

Ce que ça représente aujourd'hui :

| Traitement | Coût actuel | Part du juge |
|---|---|---|
| Un scan (10 questions × 2 modèles) | ~0,17 $ | 12 % |
| Une édition du Baromètre (100 réponses) | ~1,40 $ | 7 % |

**Modeste aujourd'hui. Déterminant demain :** le juge tourne une fois par réponse
mesurée. À 50 clients × 50 questions × 4 modèles par semaine, ça fait 10 000 appels
de juge hebdomadaires, soit environ **40 $/mois** — qui passeraient à zéro.

## Ce que je propose

Créer un compte sur un service à palier gratuit qui expose une API compatible OpenAI
(Groq, Cerebras et OpenRouter en proposent), et me donner la clé. Le code est déjà
prêt : `judge.ts` a une architecture à double moteur avec bascule automatique —
j'ajoute un troisième moteur en tête de liste, gratuit, avec repli sur l'existant
si le service tombe. Aucune régression possible.

Deux réserves que je dois te donner :

- Je n'ai pas vérifié les tarifs et limites actuels de ces services, et je ne veux
  pas te donner un chiffre que je n'ai pas contrôlé. Le raisonnement structurel,
  lui, tient : la brique juge n'a pas besoin de recherche web, donc pas du forfait.
- Il faudra comparer la qualité d'extraction sur nos 100 réponses déjà mesurées.
  On a la vérité terrain, la comparaison est gratuite et prend dix minutes. Si le
  modèle ouvert dégrade la détection des marques, on ne bascule pas.

**Coût de l'opération : 0 $.** Il me faut juste une clé de ta part.
