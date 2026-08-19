# 2026-08-19 — Le Prospecteur : où on en est de l'objectif

L'objectif énoncé au départ : **un système qui tourne tout seul et qui s'améliore.**
Ce document mesure la distance qui reste, sans arrondir vers le haut.

## Les trois axes, séparément

Un pourcentage global ne veut rien dire ici : on peut avoir écrit 90 % du code et
être à 0 % d'autonomie. Trois questions distinctes, trois réponses.

### 1. La chaîne produit-elle un email envoyable sans intervention ? — **~85 %**

| Module | État |
|---|---|
| Le Semeur | ✅ |
| Le Greffier | ✅ |
| Le Facteur | ✅ dégradé — pas de vérification SMTP, faute de VPS |
| L'Angle | ✅ |
| La Plume | ✅ |
| Le Contrôleur | ✅ |
| L'Expéditeur | ✅ |
| L'Appariement | ❌ jamais écrit |
| L'Oreille | ❌ |
| Le Directeur | ❌ |

De la question d'achat à l'email validé, la chaîne tourne de bout en bout pour 0 €.
Elle a produit **27 emails validés sur 31**, avec 100 % d'angles de niveau 1 ou 2.

Ce qui la maintient sous 100 % : le Facteur ne vérifie pas l'existence des boîtes, et
l'Appariement — rapprocher les clients d'une agence des slugs du Baromètre — n'existe
pas, alors que c'est lui qui ouvrirait la prospection des agences par leur portefeuille.

### 2. Tourne-t-elle sans qu'on la lance ? — **~70 %**, et ce n'était pas prévu

C'était le trou béant du projet il y a une heure : sans VPS, rien ne s'exécutait tout
seul. Le brief supposait un cron sur une machine qui n'existe pas.

**Elle existait déjà, deux fois.** GitHub Actions fait tourner l'Éditeur du Baromètre
en cron depuis ce dépôt, et Inngest fait tourner `daily-runner`, `econome` et
`digest`. Le palier gratuit de GitHub Actions donne 2 000 minutes par mois ; la chaîne
complète en consomme ~25 par jour, soit ~750. Elle tient, sans rien payer, et les
scripts tournent tels qu'ils ont été testés — aucun portage vers du serverless.

Deux workflows écrits :

- `prospecteur.yml` — la chaîne complète, 6 h UTC, tous les jours. Le CSV part en
  artefact téléchargeable.
- `prospecteur-envoi.yml` — l'envoi, séparé, toutes les deux heures en semaine.

Ce qui manque pour atteindre 100 % : poser les secrets dans le dépôt, et pousser. Le
premier `git push` arme les deux crons.

### 3. S'améliore-t-elle toute seule ? — **0 %**

La table `prospect_arms` existe et elle est vide. Aucun échantillonnage de Thompson,
aucun rapport du dimanche, aucune boucle de retour. **Rien n'apprend pour l'instant**,
et rien ne peut apprendre : la boucle n'est pas fermée, puisque les réponses reçues
ne reviennent jamais dans le système. C'est L'Oreille qui la ferme, et elle n'existe
pas.

C'est la partie la plus honnête du bilan : le système *produit*, il ne *progresse*
pas encore.

## Le chiffre unique, si on en veut un

**Environ 55 %** de l'objectif final, avec une répartition très inégale : la
production est largement faite, l'autonomie vient d'être débloquée, l'amélioration
continue est entièrement devant nous.

## Ce que la campagne manuelle a appris

Chiffres rapportés sur un envoi fait à la main depuis une adresse personnelle :

| Mesuré | Ce que ça dit |
|---|---|
| **25 % de mauvaises adresses** | Le Facteur adresse exactement ça : ses adresses sont **lues sur le site de l'entreprise** et leur domaine a des MX vérifiés. Le taux de rebond attendu est d'un autre ordre. |
| **10 % d'absences (vacances)** | Normal en août, et sans conséquence : une absence n'est pas un refus. L'Oreille la classera `absence`, et le coupe-circuit des 15 réponses en attente l'exclut déjà de son décompte. |
| **Aucune réponse après 1 jour** | Ce n'est pas un signal. En B2B froid, les réponses arrivent entre J+3 et J+10 ; juger à J+1 revient à conclure avant la mesure. Le coupe-circuit « taux de réponse » n'entre en jeu qu'à partir de 200 envois, précisément pour cette raison. |

La demande d'automatiser la chauffe est satisfaite : la semaine se calcule depuis le
premier envoi réel, le plafond suit 5 → 12 → 22 → 30, et le compteur du jour se
compte au lieu de se stocker. Aucune journée à ne pas oublier, aucun compteur à
remettre à zéro.

## Les trois verrous d'envoi

`sendOne()` refuse de partir si l'un des trois manque :

1. **Approbation humaine** — `--approuver` pose `scheduled_at` sur un lot, après
   lecture du CSV. C'est la relecture qu'exige CLAUDE.md §8.1, rendue exécutable.
2. **`PROSPECT_SMTP_PASSWORD`** — posée par un humain, jamais écrite dans le dépôt.
3. **`PROSPECT_SEND_LIVE=1`** — un drapeau d'environnement qu'un agent ne peut pas
   inventer en relançant un script.

Vérifié : approbation de 6 messages, étalés sur la plage ouvrée du lendemain ouvré,
puis répétition qui annonce les trois verrous manquants et n'envoie rien.

## Ce qui reste à faire, par ordre d'effet

1. **Pousser et poser les secrets** — c'est ce qui fait passer l'autonomie de 70 à
   100 %. Cinq secrets, un push.
2. **L'Oreille** — sans elle, la boucle ne se ferme pas : les réponses n'entrent
   jamais, donc le coupe-circuit des 15 en attente ne se déclenche jamais, et le
   Directeur n'a rien à apprendre.
3. **Le Directeur** — l'amélioration continue, qui passe de 0 à quelque chose.
4. **Supprimer l'enregistrement `AAAA` de `mentio.fr`** chez OVH.
5. **L'Appariement**, qui ouvrirait la prospection des agences par leur portefeuille
   de clients.
