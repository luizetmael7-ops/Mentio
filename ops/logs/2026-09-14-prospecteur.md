# 2026-09-14 — Le Prospecteur manquait de matière, pas de règles

## Constat du matin

- **Envois réels : 1 le 11 septembre, 1 le 7, 1 le 4.** Le plafond de chauffe est à 22
  par jour ; l'Expéditeur trouve un seul candidat. Le goulot est en amont.
- **La chaîne du 13 septembre n'a rien produit.** Le Semeur a démarré à 11 h 25 UTC
  (cron de 6 h, GitHub retarde de plusieurs heures) et ne s'est jamais clos : la chaîne
  est coupée à 50 minutes, le Semeur en prend 33 les bons jours. Greffier, Facteur,
  Angle, Plume, Contrôleur n'ont pas tourné.
- **64 % du temps du Semeur allait aux marques** (poids 18 contre 10), qu'on n'écrit plus.
- **Le vivier d'agences sature.** Trente questions figées, re-scannées : mêmes agences.
  Hier soir, cinq agences françaises joignables et jamais contactées.

## Ce qui a été fait

1. **Budget de temps du Semeur** : 22 minutes par défaut (`--minutes`), arrêt propre.
   La chaîne complète passe avant le nombre de questions.
2. **Le Semeur ne scanne que la cible** (`PROSPECT_TARGETS`, défaut `agency`).
3. **Quatre nouveaux gisements d'agences**, 40 questions générées et relues :
   agences growth & acquisition (FR), agences SEO e-commerce (FR), agences SEO en région
   — une ville par question (FR), agences SEO en Belgique francophone. Même acheteur,
   autres portes d'entrée. Rattachés à l'édition des agences pour l'angle.

## Coût

0,00 $. 4 appels Gemini gratuits pour générer les questions.
