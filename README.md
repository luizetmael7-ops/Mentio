# Mentio

**Mentio mesure si les assistants d'IA citent une marque quand un consommateur
demande quoi acheter — et dit quoi corriger pour y entrer.**

→ [mentio.fr](https://mentio.fr) · [le Baromètre](https://mentio.fr/barometre) ·
[la méthodologie](https://mentio.fr/methodologie)

---

## Le problème

Vos clients ne cherchent plus, ils demandent conseil. L'IA répond avec trois
marques. Si vous n'en faites pas partie, vous n'existez pas — et personne ne
mesure ça en France.

## Ce que fait Mentio

Chaque semaine, les mêmes 50 questions d'achat sont posées à ChatGPT, Gemini,
Claude et Perplexity via leurs APIs officielles, recherche web activée. Les marques
citées sont relevées, comptées, classées. Le résultat est public.

### Le barème

Un score sur 100 — la part des réponses citant la marque — et cinq paliers nommés :

| Palier | Plage |
|---|---|
| Invisible | 0–9 |
| Aperçue | 10–29 |
| Citée | 30–54 |
| Recommandée | 55–79 |
| Prescrite | 80–100 |

Le barème est public, documenté, et **personne ne paie pour changer de palier**.

### La fiabilité

Une IA ne répond pas deux fois la même chose. La mesure utilise un **échantillonnage
stratifié** : une passe sur les 50 questions, puis quatre passes de plus uniquement
là où deux marques sont à moins de trois citations d'écart. Chaque marque repart avec
un intervalle de confiance à 95 %, et **aucun mouvement de rang n'est publié si les
intervalles se chevauchent**.

Pourquoi pas cinq passes partout : environ 77 % du coût d'un appel est un forfait
fixe de recherche web, pas des tokens. Tout multiplier par cinq multiplierait la
facture par cinq sans rien apporter là où l'écart est déjà net.

## Pour les machines

Mentio mesure quelles sources les IA citent. Il serait absurde qu'il leur soit
lui-même illisible.

- [`/llms.txt`](https://mentio.fr/llms.txt) — orientation
- [`/llms-full.txt`](https://mentio.fr/llms-full.txt) — tout en un fichier
- [`/barometre.md`](https://mentio.fr/barometre.md) — le classement en Markdown
- [`/api/v1/barometre`](https://mentio.fr/api/v1/barometre) — API publique, sans clé

Réutilisation libre avec attribution : « Baromètre Mentio, mentio.fr ».

## Stack

Next.js (App Router) · Supabase · Inngest · Stripe · Vercel

Les modèles **mesurés** (ChatGPT, Gemini, Claude, Perplexity avec recherche web) ne
sont jamais substituables : le produit vend « ce que ChatGPT répond à vos clients ».
Les modèles de **traitement** — extraction des marques, génération de questions —
tournent sur des modèles ouverts en palier gratuit.

## Contribuer, contester

Le classement porte sur des marques réelles qui ne nous ont rien demandé. Toute
marque classée dispose d'un droit de réponse : [mentio.fr/contact](https://mentio.fr/contact).
Une erreur confirmée est corrigée, et l'historique conservé.

La méthode entière, limites comprises, est sur
[mentio.fr/methodologie](https://mentio.fr/methodologie).

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés
npm run dev
```

`CLAUDE.md` est la constitution du projet : produit, ICP, barème, invariants
méthodologiques, règles éditoriales, budget. Elle prime sur toute instruction
contradictoire.

---

Produit indépendant développé en France. Aucun placement payant.
