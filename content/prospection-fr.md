# Gabarits de prospection — français

Lus par `scripts/prospection/plume.ts`. Une section `## <clé>`, une ligne `Objet:`,
puis le corps.

**Ce fichier est le tien.** Un agent l'a mis à cette structure sur ta consigne ; les
mots se réécrivent à la main.

## La structure, en quatre paragraphes

1. **Le fait qui les concerne** — chiffré, et personnalisé toujours
2. **Ce qu'est Mentio** — méthode, cadence, moteurs, indépendance
3. **Ce qu'ils reçoivent** — le contenu exact du rapport
4. **Une question fermée** — jamais deux

Ce qui ne change pas : aucun prix dans le premier message, une seule question, et
c'est le rapport qui fait la vente — pas le mail.

## Ce qui a changé par rapport au brief, et pourquoi

Le brief fixait 90 mots et un seul lien. Ces gabarits font ~250 mots et deux liens
(méthodologie + rapport). C'est un arbitrage assumé après relecture d'une première
version à cinq lignes, jugée cavalière : à 30 emails par jour on peut se permettre le
registre long, et c'est précisément ce que le petit volume achète. Le Contrôleur a
été ajusté en conséquence — il exige toujours que le second lien soit la page de
méthodologie, et rien d'autre.

## Les variables

La phrase de méthode n'est **jamais écrite en dur**. `{methode}` est calculée depuis la
mesure qui a produit l'angle : moteurs réellement interrogés, recherche web ou non, date
de l'édition. Jusqu'au 13 septembre 2026, ce paragraphe affirmait « chaque semaine, à
ChatGPT, Gemini, Claude et Perplexity » — alors que les deux éditions n'avaient interrogé
que ChatGPT et Gemini. Soixante-sept emails ont porté cette affirmation fausse, dont
vingt à des agences GEO, c'est-à-dire aux lecteurs les mieux placés pour la repérer.

| Variable | D'où elle vient |
|---|---|
| `{marque}` | `prospect_brands.name` |
| `{ouverture}` | les deux phrases générées — le fait chiffré, et rien d'autre |
| `{pairs}` | « agences » ou « marques », selon la cible |
| `{rang}` · `{total_marques}` · `{score}` · `{palier}` | le Baromètre publié |
| `{edition_date}` | la date de l'édition, pour la citer |
| `{concurrent}` · `{concurrent_citations}` · `{nos_citations}` | angle « dépassement nommé » |
| `{question}` · `{gagnant_question}` | la question réelle où l'autre passe devant |
| `{questions_perdues}` · `{exemple}` · `{gagnant_exemple}` | angle « question perdue » |
| `{domaine}` | angle « domaine à conquérir » |
| `{url}` | `/rapport/[slug]`, vérifié 200 avant envoi |
| `{ligne_rapport}` | la phrase qui mène au rapport ; hors France, elle dit qu'aucune édition ne couvre encore ce marché |
| `{methode}` | calculée : moteurs interrogés, recherche web ou non, marché, date |
| `{cta}` | tiré par le bras — sections `cta-*` |
| `{signature}` | bloc fixe, obligatoire |

Une variable non remplie arrête la rédaction. Mieux vaut zéro email qu'un `{marque}`
en clair dans la boîte de quelqu'un.

---

## depassement_nomme
Objet: {marque} dans le baromètre de visibilité IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

Le rapport détaillé de {marque} contient votre score par moteur, votre rang sectoriel et votre palier, les {pairs} citées à votre place, les questions précises où vous n'apparaissez pas, les domaines que les modèles consultent pour répondre sur ce secteur, et un plan de douze actions classées par effet attendu — chacune avec sa route d'entrée, le format que le domaine publie et l'angle qui y fonctionne.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## question_perdue
Objet: {marque} dans le baromètre de visibilité IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

Le rapport détaillé de {marque} liste les questions où vous êtes absent et qui est cité à votre place, votre score par moteur, votre rang sectoriel, les domaines que les modèles consultent sur ce secteur, et douze actions classées par effet attendu — avec pour chacune la route d'entrée, le format attendu et l'angle qui passe.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## domaine_a_conquerir
Objet: {marque} et les sources que lisent les IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

Le rapport détaillé de {marque} contient les cinq domaines les plus consultés sur votre secteur avec le poids de chacun, votre score par moteur, votre rang, les {pairs} citées à votre place, et douze actions classées par effet attendu — chacune avec sa route d'entrée, le format que le domaine publie et l'angle qui y fonctionne.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## palier
Objet: {marque} dans le baromètre de visibilité IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

Le rapport détaillé de {marque} contient votre score par moteur, votre rang parmi {total_marques} marques mesurées, les {pairs} citées à votre place, les questions où vous n'apparaissez pas, les domaines que les modèles consultent sur ce secteur, et douze actions classées par effet attendu.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## absente_secteur
Objet: {marque} dans les réponses des IA

{marque} n'est citée dans aucune des {reponses_analysees} réponses de notre dernier relevé. {premier}, la plus citée, apparaît dans {citations_premier}.

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

C'est un comptage, pas une note : je ne vous attribue aucun score, et ce serait malhonnête de le faire sur cette base. {ligne_rapport}

{cta}

{signature}

## concurrent_cite
Objet: {marque} face à {concurrent} dans les réponses IA

{marque} est citée dans {citations} des {reponses_analysees} réponses de notre dernier relevé. {concurrent} l'est dans {citations_concurrent}.

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

C'est un comptage brut, sans score ni classement — l'écart parle de lui-même. {ligne_rapport}

{cta}

{signature}

## domaines_sources
Objet: {marque} et les sources que lisent les IA

Dans votre catégorie, {domaine} revient {citations_domaine} fois parmi les sources consultées par les modèles.

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. {methode} Personne ne paie pour y figurer, et la méthodologie est publique : {url_methodologie}

C'est la partie la moins documentée du sujet, et la plus actionnable : ce sont les pages que les modèles lisent avant de nommer qui que ce soit. {ligne_rapport}

{cta}

{signature}

## palier-agence
Objet: {marque} dans le baromètre des agences GEO

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques et des agences dans les réponses IA. {methode} Personne ne paie pour y figurer, sous aucune forme.

{marque} figure au classement, {rang_ordinal} sur {total_marques} agences. C'est un classement public, que vous pouvez citer tel quel. Le badge à afficher sur votre site, qui se met à jour avec chaque édition, est ici : {url_badge}

Le rapport détaillé liste les questions où vous êtes cités, les agences nommées à côté de vous et les domaines que les modèles consultent pour répondre : {url}

{cta}

{signature}

---

## cta-ferme
C'est un sujet que vous suivez ?

## cta-detail
Voulez-vous que je vous envoie le détail question par question ?

## cta-personne
À qui puis-je l'adresser chez vous ?

---

## signature
Mentio — baromètre de la visibilité des marques dans les réponses IA
mentio.fr 🇫🇷

Adresse trouvée sur le site de {marque}. Répondez « stop » et je ne vous réécris jamais.
