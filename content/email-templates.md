# Templates d'outreach agences

Une section par palier. `scripts/build-agency-outreach.ts` choisit la section
selon la colonne `palier` de `content/agences.md` et selon ce que le Baromètre
sait de la cible.

**Rien n'est écrit ici par un agent.** Ce fichier est le tien : le générateur ne
fait que remplir des variables et vérifier qu'il n'en reste aucune.

---

## Format d'une section

```
## <clé>
Objet: <la ligne d'objet, variables comprises>

<le corps, autant de paragraphes que voulu>
```

La première ligne commençant par `Objet:` est l'objet. Tout ce qui suit, jusqu'au
prochain `##`, est le corps. Les lignes vides sont conservées telles quelles.

## Les clés attendues

| Clé | Quand elle est choisie |
|---|---|
| `palier1-geo` | Palier 1, cible **absente** du Baromètre — aucun chiffre disponible |
| `palier1-classee` | Palier 1, cible **classée** — le rang part dans l'objet |
| `palier2-consultant` | Palier 2 |
| `palier3-sectorielle` | Palier 3 |
| `palier4-growth` | Palier 4 |
| `relance-j4` | Relance à J+4, tous paliers |
| `relance-j11` | Relance à J+11, tous paliers |

Une clé manquante arrête le générateur : mieux vaut zéro email qu'un email au
mauvais registre.

## Les variables

Toutes viennent du Baromètre en cours, jamais d'une saisie à la main.

| Variable | Contenu | Disponible quand |
|---|---|---|
| `{contact}` | Prénom du décideur | colonne `contact` remplie |
| `{agence}` | Nom commercial de l'agence | toujours |
| `{client}` | Nom de la marque citée dans l'email | toujours |
| `{rang}` | Rang de la cible dans son Baromètre (`3e sur 43`) | cible classée |
| `{n_eux}` | Citations de la cible — tournure « vous » | cible classée |
| `{palier}` | Palier de la cible (`Citée`, `à peine Aperçue`…) | cible classée |
| `{n_client}` | Citations du client — tournure « votre client » | cible classée |
| `{conc}` | Le concurrent qui sert de point de comparaison | un autre classé existe |
| `{n_conc}` | Citations de ce concurrent | idem |
| `{lien}` | Lien signé vers le rapport en marque blanche | toujours |
| `{secteur}` | Nom du Baromètre (`Beauté, soin & compléments`) | cible classée |
| `{total}` | Nombre de marques classées dans ce Baromètre | cible classée |
| `{date}` | Date de l'édition, en toutes lettres | cible classée |

**Une variable non résolue arrête tout**, avec le numéro de ligne de la cible et
le nom de la variable. Un `{client}` parti tel quel dans un email est le genre
d'erreur qui ne se rattrape pas.

`{n_eux}` et `{n_client}` valent le même nombre : deux noms pour deux tournures,
selon que l'email parle à l'agence de sa propre visibilité (palier 1) ou de celle
de son client (paliers 3 et 4).

---

<!--
COLLE TES TEMPLATES SOUS CETTE LIGNE, un `##` par clé du tableau ci-dessus.
Le générateur refuse de tourner tant qu'une clé attendue est absente.
-->

## palier1-classee
Objet: {client}, {rang} du classement de visibilité IA des agences GEO

{contact},

J'ai publié le 13 août le premier baromètre indépendant de la visibilité des
agences GEO françaises dans les réponses des IA. Sur {total} agences classées,
{client} ressort {rang}, avec {n_eux} citations sur 100 réponses.

Le protocole : 50 questions d'intention posées chaque semaine à ChatGPT, Gemini,
Claude et Perplexity, via leurs API officielles avec recherche web. Je relève les
agences citées, leur position dans la réponse, et les sources que les modèles
consultent. Personne n'achète sa place, aucun placement payant n'existe sous
aucune forme, et la méthodologie est publique — intervalles de confiance et
limites de la mesure compris : mentio.fr/methodologie

Le relevé détaillé de {client} est ici : {lien}
Vous y trouverez le score par moteur, les agences citées à votre place, les
questions où vous n'apparaissez pas, les domaines que les modèles consultent sur
ce secteur, et douze actions classées par effet attendu — chacune avec sa route
d'entrée, le format attendu et l'angle qui fonctionne sur le domaine visé.

Il est à vous, sans contrepartie. Le même rapport existe pour n'importe quelle
marque du baromètre beauté, à vos couleurs et transférable à un client tel quel.
Si c'est un usage qui vous intéresse, dites-le moi.

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## palier1-geo
Objet: Le classement des agences GEO françaises, par la mesure

{contact},

J'ai publié le 13 août le premier baromètre indépendant de la visibilité des
agences GEO françaises dans les réponses IA : 43 agences classées selon le nombre
de fois où ChatGPT, Gemini, Claude et Perplexity les citent en réponse à 50
questions d'intention — « meilleure agence GEO Paris », « qui peut m'aider à être
cité par ChatGPT » et leurs variantes.

{agence} n'y figure pas, et c'est précisément l'information : sur ces
questions-là, les modèles citent d'autres noms. Eskimoz sort première avec 34
citations sur 100 réponses, et la dixième en compte encore 9 — le terrain n'est
pas verrouillé, il est simplement occupé par ceux qui y sont.

Le protocole est public, intervalles de confiance et limites de la mesure
compris. Personne ne paie pour y figurer : le classement est la mesure. Le voici
en entier : {lien}

Deux choses possibles ensuite. La prochaine édition intègre les agences qui
ressortent d'ici là, sans intervention de ma part. Et je peux générer dès
aujourd'hui le rapport détaillé de n'importe quelle marque du baromètre beauté —
score par moteur, concurrents cités à sa place, questions perdues, domaines à
conquérir, douze actions classées par effet attendu — à vos couleurs et
transférable à un client tel quel.

Ça vous intéresse ?

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## palier2-consultant
Objet: Le classement des agences GEO, mesuré — en exclusivité

{contact},

Vous publiez sur la visibilité IA, et je vous écris parce que j'ai construit un
jeu de données sur ce marché qui n'existe nulle part ailleurs en France.

Mentio mesure quelles marques les IA citent réellement : 50 questions d'intention
d'achat fixes par secteur, rejouées chaque semaine sur ChatGPT, Gemini, Claude et
Perplexity, avec relevé des marques citées, de leur position, et des sources que
les modèles consultent pour répondre. Méthodologie publique, intervalles de
confiance, aucun placement payant.

Deux éditions sont en ligne. Beauté, soin et compléments : 50 marques françaises
classées, trois éditions depuis juillet, ce qui permet de suivre les mouvements
dans le temps. Agences GEO France, publiée le 13 août : 43 agences classées selon
leur visibilité réelle dans les réponses, Eskimoz en tête à 34 sur 100. C'est, à
ma connaissance, la seule mesure indépendante de ce marché.

Les données sont à vous si elles servent une publication — export, API, ou une
analyse que je rédige avec vous : {lien}
Je vous les envoie ?

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## palier3-sectorielle
Objet: Les 50 marques de soin, classées par citation IA

{contact},

Vous accompagnez des marques de beauté et de cosmétique. Il existe un canal
d'acquisition qui ne remonte dans aucun outil d'analytics, et je viens d'en
publier la mesure.

Quand un consommateur demande à ChatGPT ou Gemini quelle crème solaire clean
acheter, quel collagène choisir ou quel sérum vitamine C prendre, trois ou quatre
marques sont citées et les autres n'existent pas. Aucun clic n'est enregistré,
rien n'apparaît dans les statistiques du site. Je mesure ce canal chaque semaine
depuis juillet : 50 questions d'intention d'achat fixes, posées à ChatGPT,
Gemini, Claude et Perplexity via leurs API officielles, et relevé des marques
citées, de leur position, et des sites que les modèles ont consultés pour
répondre. 50 marques françaises sont classées.

Le résultat qui surprend le plus : la marque la mieux placée de France plafonne à
20 citations sur 100 réponses. Personne n'est installé, le terrain est vide. Et
les trois domaines que les modèles consultent le plus sur ce secteur —
cosmebio.org, aroma-zone.com et yuka.io — sont des sources que vos clients
peuvent viser directement.

Le classement complet est public, la méthodologie aussi, et personne ne paie pour
y figurer : {lien}

Si l'un de vos clients y figure et que vous voulez son rapport détaillé — score
par moteur, rang sectoriel, questions où il est absent, domaines à conquérir,
douze actions classées par effet attendu, le tout à vos couleurs et transférable
tel quel — dites-moi lequel et je le génère dans la journée.

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## palier4-growth
Objet: Le canal d'acquisition qui n'est dans aucun de vos dashboards

{contact},

Vous pilotez l'acquisition de marques e-commerce. Il existe un canal dont le
poids augmente vite et qui ne remonte dans aucun outil de mesure — je viens d'en
publier le relevé.

Quand un acheteur demande conseil à ChatGPT, Gemini ou Perplexity plutôt que de
chercher sur Google, trois ou quatre marques sont citées dans la réponse et les
autres n'existent pas. Aucun clic, aucune source, rien dans vos rapports. Je
mesure ce canal chaque semaine : 50 questions d'intention d'achat réelles par
secteur, quatre moteurs interrogés via leurs API officielles avec recherche web,
relevé des marques citées, de leur position dans la réponse, et des sites que les
modèles ont consultés pour répondre.

Deux éditions sont publiées : 50 marques de beauté et compléments, et 43 agences
GEO françaises. Sur la première, la marque la mieux placée plafonne à 20
citations sur 100 réponses — autrement dit personne n'est installé, et une marque
qui s'y met maintenant prend une place vide.

Le classement est public et personne n'y achète sa place : {lien}

Si une marque de votre portefeuille y figure, je génère son rapport détaillé —
score par moteur, rang sectoriel, questions précises où elle est absente,
domaines à conquérir, et douze actions classées par effet attendu, chacune avec
sa route d'entrée et le format que le domaine publie. À vos couleurs,
transférable au client tel quel.

Dites-moi laquelle et je vous l'envoie.

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## relance-j4
Objet: Je remonte ce message

{contact}, je remonte ce message au cas où il serait passé.

Le relevé est prêt et il est à vous, sans contrepartie : {lien}

Je vous le détaille, ou je laisse tomber ?

Luiz

## relance-j11
Objet: Dernier message — le Baromètre est public

{contact}, dernier message sur le sujet.

Le Baromètre est publié, gratuit et sans compte : {lien}
Prenez ce qui vous sert.

Je ne relancerai plus. Si le sujet remonte chez vous un jour, mon adresse ne
change pas.

Luiz

## cible:eskimoz
Objet: Eskimoz, 1re du classement de visibilité IA des agences GEO

{contact},

J'ai publié le 13 août le premier baromètre indépendant de la visibilité des
agences GEO françaises dans les réponses des IA. Sur {total} agences classées,
Eskimoz sort première, avec un score de {n_eux} sur 100.

Le protocole : 50 questions d'intention posées chaque semaine à ChatGPT, Gemini,
Claude et Perplexity, via leurs API officielles avec recherche web. Je relève les
agences citées, leur position dans la réponse, et les sources que les modèles
consultent. Personne n'achète sa place, aucun placement payant n'existe sous
aucune forme, et la méthodologie est publique — intervalles de confiance et
limites de la mesure compris.

Le relevé détaillé d'Eskimoz est ici : {lien}
Vous y trouverez le score par moteur, les agences citées à votre place, les
questions où vous n'apparaissez pas, les domaines que les modèles consultent sur
ce secteur, et douze actions classées par effet attendu.

Il est à vous, sans contrepartie. Le même rapport existe pour n'importe quelle
marque du baromètre beauté, à vos couleurs et transférable à un client tel quel.
Si c'est un usage qui vous intéresse, dites-le moi.

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## cible:natural-net
Objet: La 4e étape de votre méthodologie, mesurée en continu

{contact},

Votre méthodologie GEO se conclut par le monitoring continu de la part de voix
sur les moteurs génératifs. C'est exactement ce que je fabrique, et je vous écris
parce que peu d'agences en France ont formulé cette étape aussi explicitement.

Mentio est un baromètre indépendant de la visibilité des marques dans les
réponses IA. Chaque semaine, je pose 50 questions d'intention d'achat fixes à
ChatGPT, Gemini, Claude et Perplexity — via leurs API officielles, recherche web
activée — puis je relève les marques citées, leur position, et les sources que
les modèles ont réellement consultées pour répondre. La méthodologie est
publique, intervalles de confiance compris : mentio.fr/methodologie

J'ai publié le 13 août le premier classement des agences GEO françaises.
Natural-Net y figure, {rang}, avec {n_eux} citations. Le rapport détaillé
contient votre score et votre palier, les agences citées à votre place, les
questions où vous n'apparaissez pas, les sites que les modèles consultent sur ce
secteur, et un plan de douze actions classées par effet attendu — chacune avec sa
route d'entrée, le format attendu et l'angle qui fonctionne sur le domaine visé.

Le voici : {lien}

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## cible:iaba-tech
Objet: Le chiffre de départ qui manque à un audit GEO

{contact},

Vous vendez de la visibilité IA en B2B avec une structure entièrement remote, ce
qui suppose que la donnée passe avant le décor. C'est pour ça que je vous écris.

Un audit GEO commence par un chiffre de départ, et il n'existe pas de source
neutre pour ce chiffre en France. Mentio le produit : 50 questions d'intention
d'achat fixes, rejouées chaque semaine sur ChatGPT, Gemini, Claude et Perplexity,
avec relevé des marques citées, de leur position et des sources consultées.
Échantillonnage stratifié, intervalles de confiance publiés, et aucun mouvement
de rang publié sous le seuil de bruit — ce qui écarte la plupart des chiffres qui
circulent aujourd'hui sur le sujet.

iaba.tech figure au classement des agences GEO publié le 13 août, {rang}, avec
{n_eux} citations. Le rapport contient votre score par moteur, les concurrents
cités à votre place, les questions perdues, les domaines à conquérir, et douze
actions priorisées avec leur route d'entrée : {lien}

Le même document se génère pour n'importe lequel de vos clients, à vos couleurs.
Je vous en envoie un ?

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## cible:seo-fr
Objet: Données inédites sur les citations IA — proposition de publication

{contact},

Vous avez publié une étude OpinionWay sur les moteurs de recherche et les outils
d'IA. Je vous écris parce que j'ai construit un jeu de données qui la complète
directement, et qui n'existe nulle part ailleurs en France.

Mentio relève chaque semaine ce que ChatGPT, Gemini, Claude et Perplexity
répondent réellement à 50 questions d'intention d'achat par secteur : quelles
marques sont citées, à quelle position, et surtout quels sites les modèles ont
consultés pour répondre. Deux éditions sont publiées — beauté et compléments
(50 marques), agences GEO françaises ({total} agences) — avec la méthodologie
complète, les intervalles de confiance et les limites de la mesure. Aucun
placement payant n'existe : le classement est la mesure.

SEO.fr figure d'ailleurs dans la seconde, {rang}, avec {n_eux} citations. Votre
relevé détaillé est ici : {lien}

Les données brutes sont disponibles pour une publication commune, en accès API ou
en export. Je peux aussi produire une édition sur un secteur de votre choix si
l'angle vous intéresse davantage. À qui puis-je les transmettre ?

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice

## cible:jalousie-agency
Objet: Jalousie dans le classement des agences GEO françaises

Bonjour,

J'ai publié le 13 août le premier baromètre indépendant de la visibilité des
agences GEO françaises dans les réponses IA. Jalousie y figure, {rang}, avec {n_eux} citations sur 100 réponses.

Le principe : 50 questions d'intention — « quelle agence peut m'aider à être cité
par ChatGPT », « meilleure agence GEO Paris » et leurs variantes — posées chaque
semaine à ChatGPT, Gemini, Claude et Perplexity. Je relève qui est cité, à quelle
position, et quelles sources les modèles ont consultées. Personne ne paie pour
être classé, et la méthode est publiée en entier.

Le rapport de Jalousie détaille votre score, votre rang, les agences citées à
votre place, les questions où vous êtes absents, et douze actions concrètes
classées par effet attendu : {lien}

À qui puis-je l'adresser ?

Luiz
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr · Nice
