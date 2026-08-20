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
| `{cta}` | tiré par le bras — sections `cta-*` |
| `{signature}` | bloc fixe, obligatoire |

Une variable non remplie arrête la rédaction. Mieux vaut zéro email qu'un `{marque}`
en clair dans la boîte de quelqu'un.

---

## depassement_nomme
Objet: {marque} dans le baromètre de visibilité IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, je pose les mêmes 50 questions d'intention d'achat à ChatGPT, Gemini, Claude et Perplexity — via leurs API officielles, recherche web activée — puis je relève les marques citées, leur position dans la réponse, et les sources que les modèles ont réellement consultées. Personne ne paie pour figurer au classement, sous aucune forme, et la méthodologie est publique, intervalles de confiance et limites compris : {url_methodologie}

Le rapport détaillé de {marque} contient votre score par moteur, votre rang sectoriel et votre palier, les {pairs} citées à votre place, les questions précises où vous n'apparaissez pas, les domaines que les modèles consultent pour répondre sur ce secteur, et un plan de douze actions classées par effet attendu — chacune avec sa route d'entrée, le format que le domaine publie et l'angle qui y fonctionne.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## question_perdue
Objet: {marque} dans le baromètre de visibilité IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, je pose les mêmes 50 questions d'intention d'achat à ChatGPT, Gemini, Claude et Perplexity — via leurs API officielles, recherche web activée — puis je relève les marques citées, leur position, et les sources que les modèles ont consultées pour répondre. Aucune place ne s'achète et la méthodologie est publiée en entier : {url_methodologie}

Le rapport détaillé de {marque} liste les questions où vous êtes absent et qui est cité à votre place, votre score par moteur, votre rang sectoriel, les domaines que les modèles consultent sur ce secteur, et douze actions classées par effet attendu — avec pour chacune la route d'entrée, le format attendu et l'angle qui passe.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## domaine_a_conquerir
Objet: {marque} et les sources que lisent les IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, les mêmes 50 questions d'intention d'achat sont posées à ChatGPT, Gemini, Claude et Perplexity via leurs API officielles, recherche web activée. Je relève non seulement les marques citées, mais surtout les domaines que les modèles ont consultés pour construire leur réponse — c'est la partie la moins documentée du sujet, et la plus actionnable. Méthodologie publique : {url_methodologie}

Le rapport détaillé de {marque} contient les cinq domaines les plus consultés sur votre secteur avec le poids de chacun, votre score par moteur, votre rang, les {pairs} citées à votre place, et douze actions classées par effet attendu — chacune avec sa route d'entrée, le format que le domaine publie et l'angle qui y fonctionne.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## palier
Objet: {marque} dans le baromètre de visibilité IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, je pose les mêmes 50 questions d'intention d'achat à ChatGPT, Gemini, Claude et Perplexity — API officielles, recherche web activée — et je relève qui est cité, à quelle position, et depuis quelles sources. Le barème est public et personne ne paie pour changer de palier : {url_methodologie}

Le rapport détaillé de {marque} contient votre score par moteur, votre rang parmi {total_marques} marques mesurées, les {pairs} citées à votre place, les questions où vous n'apparaissez pas, les domaines que les modèles consultent sur ce secteur, et douze actions classées par effet attendu.

Il est là, sans contrepartie : {url}

{cta}

{signature}

## absente_secteur
Objet: {marque} dans les réponses des IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, les mêmes questions d'intention d'achat sont posées à ChatGPT, Gemini, Claude et Perplexity, et je relève qui est cité, à quelle position, et depuis quelles sources. Personne ne paie pour y figurer, et la méthode est publique : {url_methodologie}

Ce relevé porte sur {questions} questions de votre catégorie et {reponses_analysees} réponses analysées. {marque} n'apparaît dans aucune. C'est un comptage, pas une note : je ne vous attribue aucun score, et ce serait malhonnête de le faire sur cette base.

L'édition publiée de votre secteur est là : {url}

{cta}

{signature}

## concurrent_cite
Objet: {marque} face à {concurrent} dans les réponses IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, les mêmes questions d'intention d'achat sont posées à ChatGPT, Gemini, Claude et Perplexity, et je relève qui est cité. Personne ne paie pour y figurer, et la méthode est publique : {url_methodologie}

Sur {questions} questions de votre catégorie, {marque} est citée {citations} fois. {concurrent} l'est {citations_concurrent} fois. C'est un comptage brut, sans score ni classement — l'écart parle de lui-même.

L'édition publiée de votre secteur est là : {url}

{cta}

{signature}

## domaines_sources
Objet: {marque} et les sources que lisent les IA

{ouverture}

Mentio est un baromètre indépendant de la visibilité des marques dans les réponses IA. Chaque semaine, les mêmes questions d'intention d'achat sont posées à ChatGPT, Gemini, Claude et Perplexity, et je relève surtout les domaines qu'ils consultent pour répondre. Méthode publique : {url_methodologie}

Sur votre catégorie, {domaine} revient {citations_domaine} fois dans les sources consultées. C'est la partie la moins documentée du sujet et la plus actionnable : ce sont ces pages que les modèles lisent avant de nommer une marque.

L'édition publiée de votre secteur est là : {url}

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
