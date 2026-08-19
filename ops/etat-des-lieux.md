# Mentio — état des lieux

*Écrit du point de vue de quelqu'un qui découvre ce projet aujourd'hui, connaît le
métier, et n'a assisté à aucune des décisions. Les chiffres viennent de la base de
production le 19 août 2026.*

---

## Ce que c'est

Un produit qui mesure si les assistants d'IA citent une marque quand un consommateur
demande quoi acheter, et qui dit quoi corriger pour y entrer. Vendu aux agences SEO
et growth françaises, pas aux marques.

Techniquement : ~17 000 lignes de produit (Next.js, Supabase, Inngest, Stripe,
Vercel) et ~4 000 lignes d'un sous-système de prospection autonome. 25 pages
publiques, 6 routes d'API, 9 tâches planifiées.

---

## Ce que le projet possède réellement

### Un corpus de mesure, et il est réel

| | |
|---|---|
| Éditions publiées | **6**, sur deux verticales (beauté & compléments, agences GEO France) |
| Relevés bruts | **280** |
| Mentions de marques mesurées | **989** |
| Marques classées | 93, dont **43 agences** |
| Dépense LLM cumulée, depuis le début | **6,43 $** |

Ce dernier chiffre mérite qu'on s'y arrête. 989 mentions mesurées sur quatre moteurs
avec recherche web, pour six dollars et quarante-trois cents. Ce n'est pas un
prototype qui coûterait cher à faire tourner en vrai : c'est déjà le vrai, et il ne
coûte rien. La discipline budgétaire n'est pas une intention affichée dans un
document, elle est vérifiable dans la table `llm_spend`.

### Un vocabulaire de catégorie

Cinq paliers nommés — Invisible, Aperçue, Citée, Recommandée, Prescrite — définis une
seule fois dans `src/lib/spectrum.ts` et lus par le site, le badge, les images OG, les
emails, l'API et les rapports. Personne ne paie pour changer de palier.

C'est le pari le plus intéressant du projet, et il est correctement exécuté. Le
mécanisme visé est celui du Nutri-Score : personne ne retient qui mesure le mieux,
tout le monde retient qui a nommé l'échelle. Le jour où une agence écrit « la marque
est passée d'Aperçue à Citée », l'affaire est gagnée même si un concurrent a mesuré.

### Un rapport qui est un argument de vente, pas une capture d'écran

`/rapport/[slug]` produit, **sans aucun appel LLM**, un document qui contient le score
par moteur, le rang sectoriel, les concurrents cités à la place de la marque, les
questions précises où elle est absente, les domaines que les modèles consultent pour
répondre, et douze actions classées par effet attendu — chacune avec sa route
d'entrée, le format attendu et l'angle qui fonctionne.

Il est public, partageable par lien, et se génère aux couleurs d'une agence via des
paramètres d'URL — rien à administrer, rien à stocker. Une agence peut en produire
trente en une heure et les poser devant trente prospects.

C'est, de loin, le meilleur actif commercial du projet.

### Une machine de prospection complète

Dix modules, de la découverte d'une marque dans une réponse d'IA jusqu'à la lecture
de ce qu'elle répond. Elle a produit, en état de marche : 143 marques au vivier, 65
adresses envoyables, 31 angles dont **100 % de niveau fort**, 27 emails validés par
un contrôle à droit de veto.

Trois choses la distinguent d'un outil de cold email ordinaire :

1. **Elle refuse d'envoyer plus souvent qu'elle n'accepte.** Un prospect sans fait
   chiffré vérifiable ne reçoit rien. À 30 emails par jour, la rareté est l'angle.
2. **Elle s'arrête quand l'humain prend du retard** — au-delà de 15 réponses non
   traitées, l'envoi se coupe. Le système ne produit jamais plus de conversations que
   son opérateur ne peut en tenir.
3. **Elle ne coûte rien.** Trois garanties indépendantes rendent un appel payant
   impossible, dont une clé étrangère en base.

### Une discipline de sûreté inhabituelle

Trois règles produit sont posées **dans le schéma**, pas dans le code : une question
de mesure figée ne peut pas être modifiée, une réponse brute non publiée expire à 90
jours, une adresse devinée non vérifiée ne peut pas recevoir de message. Un `UPDATE`
qui violerait l'une d'elles lève une exception PostgreSQL.

C'est rare, et c'est le bon endroit : une règle qui ne vit que dans le code se
contourne le jour où quelqu'un réécrit le module.

---

## Ce que le projet ne possède pas

**Aucun client.** Une organisation en base, zéro payante. Une marque cliente. Un lead
capté. Onze scans publics depuis le lancement.

C'est le seul chiffre qui compte et il est à zéro. Tout le reste — le corpus, le
barème, le rapport, la machine de prospection — est de l'outillage tant qu'il n'a
pas rencontré quelqu'un qui paie.

Un observateur extérieur dirait ceci sans détour : **ce projet a construit un moteur
remarquable et n'a encore parlé à presque personne.** Les 27 emails prêts à partir
sont, à ce jour, la seule chose qui puisse changer cet état de fait.

---

## Ce qui est fragile

**La couverture du Baromètre est le facteur limitant de tout le reste.** Elle est
apparue deux fois, indépendamment :

- l'Angle ne peut écrire qu'à une marque déjà mesurée — sur 61 marques découvertes
  par scan, 8 l'étaient ;
- l'Appariement, qui doit relier les clients d'une agence aux marques classées, a
  rendu zéro paire sur six agences : leurs clients ne sont pas dans les deux
  verticales publiées.

Deux verticales, 93 marques. Chaque verticale supplémentaire coûte environ 2,85 $ par
édition hebdomadaire et débloque simultanément le vivier de prospection, la valeur de
chaque email, et l'Appariement. C'est le seul goulot du projet, et il est unique.

**Un point d'exécution unique.** Un fondateur seul, en prépa, avec environ une heure
par semaine en période scolaire. Le système en tient compte — il s'arrête tout seul
quand les réponses s'accumulent — mais aucun automatisme ne remplace la personne qui
répond à un prospect intéressé.

**Deux dépendances de délivrabilité.** Une seule boîte d'envoi, sur le domaine
principal du produit : ce qui brûle là brûle aussi les rapports des clients payants.
Et un enregistrement DNS `AAAA` résiduel sur `mentio.fr` envoie tout visiteur en IPv6
vers un serveur d'hébergement OVH qui présente un certificat invalide — c'est-à-dire
un avertissement de sécurité pleine page, sur le domaine d'un produit dont l'argument
est la crédibilité.

---

## Ce qu'un observateur ferait, dans l'ordre

1. **Supprimer l'enregistrement `AAAA`.** Une ligne. Aujourd'hui, une partie des
   visiteurs voit un avertissement de sécurité.
2. **Envoyer les 27 emails.** Ils sont écrits, vérifiés, et adossés à une mesure
   réelle. Le seul risque est de ne pas les envoyer.
3. **Étendre le Baromètre à une troisième verticale**, dès qu'un premier client
   justifie les ~12 $/mois. C'est ce qui débloque tout le reste.
4. **Ne rien coder pendant deux semaines.** Le moteur est complet ; ce qui manque
   n'est pas du logiciel.
