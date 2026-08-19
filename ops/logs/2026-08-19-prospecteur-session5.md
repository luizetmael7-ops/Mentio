# 2026-08-19 — Le Prospecteur, session 5 (L'Oreille, Le Directeur, L'Appariement)

Les dix modules sont écrits. La boucle est fermée.

## L'Oreille — le module dont l'absence rendait les autres aveugles

IMAP en lecture seule sur `seshat@mentio.fr`. **Elle n'expose aucune fonction
d'envoi** : c'est la contrepartie technique de la règle 4 du brief, « jamais de
réponse automatique à un humain ». Elle ne supprime rien non plus — les messages lus
sont marqués `\Seen`, et c'est tout : effacer la trace d'une réponse rendrait
impossible de vérifier plus tard qu'un classement était juste.

### La nuance qui compte, et qui vient du terrain

Le refus reçu à J+4 sur la campagne manuelle — « Merci pour votre proposition, nous
n'y donnerons pas suite » — est exactement le cas limite du classement :

| Catégorie | Ce que c'est | Effet |
|---|---|---|
| `negative` | un refus poli ou net | l'**adresse** part en suppression ; l'entreprise reste au vivier |
| `opposition` | « stop », « retirez-moi », RGPD | le **domaine entier** part, définitivement |

Confondre les deux coûte cher dans les deux sens. Traiter un refus comme une
opposition perd une entreprise pour toujours — un non en août 2026 n'est pas un non
en 2027. Traiter une opposition comme un refus expose à une plainte, et le seuil
d'arrêt total est à 0,05 %.

`opposition` et `rebond` sont classés **avant tout appel au modèle**, par expressions
régulières et en-têtes RFC 3464. C'est gratuit, et c'est surtout plus sûr : on ne
confie pas à quelque chose qui peut halluciner un jugement dont l'erreur produit une
plainte.

## Le Directeur — le bandit, en vingt lignes et zéro dépendance

Échantillonnage de Thompson sur `prospect_arms`. Une loi bêta par bras, un tirage, on
prend le maximum. Le tirage gamma est implémenté à la main (Marsaglia–Tsang) plutôt
que d'ajouter une bibliothèque statistique pour trente lignes.

Trois garde-fous, appliqués :

- **25 % d'exploration permanente** — un quart des envois ignore ce qu'on croit savoir ;
- **40 envois minimum** avant qu'un bras puisse être déprioritisé. Sous ce seuil, le
  tirage est forcé optimiste : le bras reste pleinement candidat tant qu'on ne l'a pas
  assez observé ;
- **une seule variable modifiée par semaine**, et c'est un humain qui la modifie.

Le bandit ne décide QUE du CTA. Le secteur, le pays et l'angle viennent des données,
pas d'un pari.

Le rapport du dimanche part en **pull request**, jamais sur `main` — même règle que
l'Éditeur du Baromètre. Il propose ; il n'a modifié ni le gabarit, ni le Contrôleur,
ni les exclusions, ni les poids de la matrice.

Premier rapport produit ce soir, et sa recommandation est juste : *« Aucun envoi cette
semaine. Le système produit des emails que personne ne reçoit — c'est le moment de
poser les secrets et d'approuver un lot. »*

## L'Appariement — écrit, et honnêtement à vide

Il lit les pages « références » d'une agence et rapproche les noms de clients des
slugs du Baromètre. Seuil de confiance à 0,8, en dessous duquel il ne propose rien :
un mauvais appariement met le nom d'un client dans un email adressé à quelqu'un qui
n'est pas son agence.

**Exécuté sur 6 agences : 5 pages lues, 0 paire retenue.** Ce n'est pas un défaut du
module, c'est une conséquence de la couverture du Baromètre. Les 93 marques classées
sont de la beauté, des compléments et des agences ; les clients d'une agence GEO n'ont
aucune raison d'y figurer. Sa valeur est bornée exactement comme celle de l'Angle
l'était — elle se débloquera le jour où le Baromètre couvrira d'autres verticales.

C'est la deuxième fois que la même limite apparaît, et elle mérite d'être nommée :
**la couverture du Baromètre est le facteur limitant du Prospecteur entier**, devant
les adresses, devant les gabarits, devant tout le reste.

## L'ordonnancement — le VPS n'a jamais manqué

Trois workflows GitHub Actions, sur un ordonnanceur qui tournait déjà dans ce dépôt :

| Workflow | Cadence | Contenu |
|---|---|---|
| `prospecteur.yml` | tous les jours 6 h UTC | Semeur → Greffier → Facteur → Angle → Plume → Contrôleur → bilan, CSV en artefact |
| `prospecteur-envoi.yml` | 5×/jour, lun–ven | **Oreille**, puis état des coupe-circuits, puis Expéditeur |
| `prospecteur-directeur.yml` | dimanche 18 h UTC | crédite les bras, écrit le rapport, ouvre une PR |

L'Oreille passe **avant** l'Expéditeur, et l'ordre n'est pas cosmétique : c'est elle
qui met à jour le compteur des réponses en attente, lequel autorise ou bloque l'envoi.
Lire après avoir envoyé reviendrait à décider sur des données périmées d'un cycle.

Consommation estimée : ~750 minutes/mois sur les 2 000 gratuites.

## L'envoi, et ses trois verrous

`sendOne()` refuse de partir si l'un des trois manque :

1. **Approbation humaine** — `--approuver` pose `scheduled_at` sur un lot après
   lecture du CSV. C'est la relecture qu'exige CLAUDE.md §8.1, rendue exécutable.
2. **`PROSPECT_SMTP_PASSWORD`** — posée par un humain. Aucun identifiant n'est écrit
   dans le dépôt, et l'agent n'en a jamais enregistré.
3. **`PROSPECT_SEND_LIVE=1`** — un drapeau d'environnement qu'un agent ne peut pas
   inventer en relançant un script.

La chauffe est automatique : la semaine se calcule depuis le premier envoi réel, le
plafond suit 5 → 12 → 22 → 30, et le compteur du jour se **compte** au lieu de se
stocker — un compteur stocké doit être remis à zéro chaque nuit par quelqu'un, et ce
quelqu'un oublie.

## Ce que la campagne manuelle a mesuré

| Observé | Ce que le système en fait |
|---|---|
| 25 % de mauvaises adresses | Le Facteur ne retient que des adresses **publiées par l'entreprise** avec MX vérifié |
| 10 % d'absences | Classées `absence`, et exclues du compteur des 15 réponses en attente |
| Aucune réponse à J+4, 1 refus | Trop tôt pour conclure. Le coupe-circuit « taux de réponse » n'entre en jeu qu'à 200 envois, précisément parce qu'un jugement à J+4 sur quelques dizaines d'envois mesure du bruit |

## Coût

**0,00 $** sur les cinq sessions. Aucun appel payant, jamais.
