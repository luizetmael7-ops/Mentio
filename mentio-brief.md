# Mentio — Brief projet & spec de build
_Source de vérité du projet. Claude Code doit lire ce fichier en entier avant d'écrire du code, et s'y référer à chaque décision._

Nom de travail : **Mentio** (backups : Modl, Citavo). À vérifier avant de committer : disponibilité domaine (.com / .fr) + marque INPI. Ce n'est pas bloquant pour le build.

---

## 1. Le pitch en une phrase
Mentio mesure et améliore, en continu, la présence d'une marque dans les réponses des IA (ChatGPT, Claude, Gemini, Perplexity), pour les marques DTC françaises — le « SEO de l'ère des moteurs de réponse ».

## 2. Le problème & l'insight
- La découverte produit migre de Google vers les réponses IA. Quand un client demande « quelle est la meilleure crème solaire clean ? », une marque est citée… ou invisible.
- **Insight clé (le moat) :** les sources citées par les IA changent énormément dans le temps et diffèrent d'un modèle à l'autre. Un score ponctuel est une commodité (ChatGPT le donne gratis). La valeur est la **base de données longitudinale** — le suivi jour après jour, par modèle, face aux concurrents — impossible à répliquer sans avoir tourné pendant des mois. La donnée dans le temps + la verticale, pas le prompt.

## 3. ICP & beachhead
- **Beachhead v0 :** fondateurs / responsables acquisition de marques DTC FR en **beauté, cosmétique, compléments alimentaires** (fort volume de requêtes « meilleure marque de… » adressées aux IA, forte willingness-to-pay).
- **Amplificateur :** agences growth/SEO qui gèrent plusieurs de ces marques → compte multi-marques, LTV élevée, diffusion virale intra-agence.
- **Expansion :** autres verticales DTC (nutrition sportive, skincare, maison) → tout le ecom FR → EU. Une verticale = une communauté qu'on sature avant de passer à la suivante.

## 4. Précédents & positionnement
- **Profound** (US) : licorne, ~155 M$ levés, ~6,8 M$ de revenus 2025, 700+ clients enterprise. Modules : Answer Engine Insights, Agent Analytics, Conversation Explorer, Profound Agents. Cible : entreprises 10–500 M$+ de CA, surtout US.
- **Peec AI** (EU) : ~21 M$ Série A, AEO mid-market européen. Menace directe → il faut aller plus vite et plus vertical.
- **À copier :** l'architecture Monitor → Sources → Act, l'idée d'un index de visibilité standardisé, le suivi multi-modèles avec citations et sentiment.
- **À faire différemment (le wedge) :** self-serve (pas de vente enterprise), prix ~10× inférieur, français natif, verticalisé beauté/compléments, distribution par build-in-public + aimant gratuit + agences.

## 5. Le produit (modules) & roadmap
**Module A — Monitor (cœur).** Pour chaque marque : un set de prompts d'intention d'achat de sa verticale, joués chaque jour sur 4 modèles. On extrait : citée ou non, position/rang, sentiment, concurrents cités, sources citées. Score de visibilité + share-of-voice dans le temps, par modèle.

**Module B — Sources intelligence.** Quels domaines les modèles citent-ils pour cette catégorie (Reddit, sites d'avis, listicles, presse) ? → liste priorisée « fais-toi référencer ici ». C'est le vrai levier GEO.

**Module C — Prompt/Conversation discovery.** Quelles questions la niche pose-t-elle vraiment aux IA ? → élargit le set de prompts et révèle des angles.

**Module D — Act (agentique, la vision ambitieuse).** Un agent qui génère les correctifs : pages comparatives, FAQ schema.org, `llms.txt`, briefs d'articles, drafts d'outreach vers les sources citées. On ne mesure plus seulement, on fait remonter.

**Module E — Agence / multi-marques.** Tableau de bord multi-marques, rapports partageables en marque blanche, accès API.

**Roadmap :**
- **v0 (semaines 1–4) :** Module A + aimant gratuit + Stripe + digest email hebdo. UNE librairie de prompts (beauté/compléments).
- **v1 (semaines 5–10) :** Module B + alertes + recommandations (règles → générées par LLM) + Module E (multi-marques, rapport marque blanche).
- **v2 (ambitieux) :** Module C + Module D + attribution « referral IA » (tracer le trafic/les conversions venant des IA).

## 6. Le lead magnet (moteur de croissance)
Page publique : la marque entre **nom + catégorie** → scan live de ~10 prompts sur 2–3 modèles → affiche un **score teaser** + un choc (« ton concurrent est cité 8/10, toi 1/10 ») → **gate email** pour le rapport complet + essai. C'est le haut de funnel viral et l'actif de contenu (chaque scan alimente des études publiques).

## 7. Architecture technique & stack
- **Front / app :** Next.js (App Router, TypeScript) + Tailwind + shadcn/ui. Déploiement **Vercel**.
- **Backend / DB / auth :** **Supabase** (Postgres + Auth + storage).
- **Jobs durables (fan-out multi-LLM, retries, concurrence) :** **Inngest** (ou Trigger.dev). Déclencheur quotidien via cron.
- **LLM :** APIs directes OpenAI, Anthropic, Google (Gemini), + **Perplexity** (expose nativement les citations). Activer la recherche web / grounding quand disponible.
- **Extraction (juge) :** un appel LLM « LLM-as-judge » qui renvoie du **JSON structuré** (marques mentionnées, positions, sentiment, sources).
- **Paiement :** Stripe (Checkout + Billing + webhooks).
- **Emails :** Resend (digests, alertes).
- **Analytics produit :** PostHog.
- Principe : rien d'exotique, tout dans les cordes de Claude Code, local d'abord puis Vercel.

## 8. Modèle de données (tables Postgres / Supabase)
- `organizations` (id, name, type: 'brand'|'agency', stripe_customer_id, plan)
- `users` (id, org_id, email, role)
- `brands` (id, org_id, name, domain, vertical, created_at)
- `competitors` (id, brand_id, name, domain)
- `prompts` (id, vertical, text, intent, is_active) — librairie mutualisée par verticale + prompts custom par marque
- `brand_prompts` (brand_id, prompt_id) — quels prompts sont suivis pour cette marque
- `prompt_runs` (id, brand_id, prompt_id, model, run_at, raw_answer, cited_sources jsonb, status)
- `mentions` (id, prompt_run_id, brand_or_competitor, name, is_target_brand, cited bool, position int, sentiment)
- `sources` (id, vertical, domain, times_cited, last_seen) — agrégat pour Sources intelligence
- `scores` (id, brand_id, date, model, visibility_score, share_of_voice) — **la table-moat, longitudinale**
- `subscriptions` (org_id, stripe_sub_id, plan, status, current_period_end)
- `leads` (email, brand_name, category, teaser_score, created_at) — issus du lead magnet

## 9. Les boucles d'agent (jobs Inngest)
1. **Runner** — pour chaque marque active, chaque jour : joue son set de prompts sur les N modèles du plan → écrit `prompt_runs` (réponse brute + sources citées).
2. **Juge/extracteur** — pour chaque `prompt_run` : LLM extrait `{brands_mentioned, positions, sentiment, sources}` en JSON → écrit `mentions` (+ met à jour `sources`).
3. **Scorer** — agrège `mentions` → `scores` du jour par marque/modèle : visibility_score (0–100) + share-of-voice vs concurrents.
4. **Digest/alertes** — hebdo par email ; alertes seuil (chute, dépassement par un concurrent).
5. **(v1) Source aggregator** — recalcule `sources` par verticale → liste priorisée.
6. **(v2) Action agent** — génère pages comparatives / FAQ schema / `llms.txt` / drafts outreach.

## 10. Le point dur (à traiter honnêtement)
Les réponses via **API ≠ réponses des apps grand public** (RAG temps réel, personnalisation). Profound insiste là-dessus.
- **v0 :** on approxime avec les **APIs + recherche web/grounding activée** et Perplexity (citations natives). C'est un compromis assumé et suffisant pour démarrer — on le dit clairement au client (« mesure basée API grounded »).
- **Plus tard :** viser une meilleure fidélité à la surface consommateur. Automatiser les apps grand public en headless est fragile et hors CGU → **à éviter** ; privilégier les surfaces avec API/citations officielles. Ne pas bâtir le produit sur du scraping d'apps.

## 11. Coûts & pricing
**Réalité des coûts :** chaque réponse « grounded » coûte ~0,02–0,10 $. 50 prompts × 4 modèles en quotidien = trop cher pour un petit plan. → **La cadence et le nombre de prompts sont gérés PAR PALIER** pour garder la marge. Mesurer le coût réel dès la 1re semaine et caler les quotas dessus.

| Palier | Prix | Marques | Prompts | Modèles | Cadence | Extras |
|---|---|---|---|---|---|---|
| Free | 0 | 1 | 10 | 1 | hebdo | aimant / teaser |
| Starter | 49 €/mo | 1 | 50 | 4 | hebdo | 5 concurrents |
| Growth | 149 €/mo | 3 | 150 | 4 | quotidien | alertes + Sources |
| Agency | 499 €/mo | 10 | 150 | 4 | quotidien | marque blanche + API |

Add-ons usage-based (prompts/marques supplémentaires). Annuel = 2 mois offerts.

## 12. Go-to-market (la machine)
1. **Aimant gratuit** (Module lead magnet) = haut de funnel viral + collecte d'emails qualifiés.
2. **Build-in-public FR (X + LinkedIn)** : études hebdo factuelles (« j'ai demandé 100× à ChatGPT la meilleure marque de X, voici le classement »). Data, pas d'opinion. Extrêmement partageable dans le milieu ecom/marketing.
3. **Cold outreach ciblé** : 50 marques beauté/compléments FR, chacune reçoit **son rapport gratuit** (« voici votre score, votre concurrent vous bat »).
4. **Revendeurs agences** : 2–3 agences growth → chacune = 10+ marques (multiplicateur LTV + distribution).
5. **Listings** : TrustMRR (branche Stripe → backlink + crédibilité), Product Hunt, Indie Hackers.
6. **Dogfooding GEO** : se classer soi-même dans les réponses IA pour « outil visibilité IA / suivi ChatGPT marque ».

CAC visé ≈ 0 au départ (organique + aimant). On n'achète de l'acquisition qu'une fois un canal payant rentable identifié.

## 13. Métriques & jalons
- **North star :** nombre de marques suivies quotidiennement (usage réel) + Net Revenue Retention.
- Jalon 1 : aimant en ligne + 100 scans lancés → 20 emails qualifiés.
- Jalon 2 : **3 clients pré-vendus payants** (validation — construits AVANT le v1 lourd).
- Jalon 3 : **15 payants ≈ 2–4 K€ MRR** = vrai business.
- Jalon 4 : 1re agence revendeuse.
- Suivre dès le départ : activation, conversion free→payant, churn (le vrai juge).

## 14. Variables d'environnement nécessaires
```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
PERPLEXITY_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
```
Où les obtenir : dashboards respectifs (OpenAI/Anthropic/Google AI Studio/Perplexity, Supabase, Stripe, Resend, Inngest, PostHog). Compte gratuit suffisant pour démarrer partout.

## 15. Ordre de build pour Claude Code (v0 d'abord, ne pas coder v1/v2 maintenant)
1. **Scaffold** : Next.js (App Router, TS) + Tailwind + shadcn/ui ; connecter Supabase (Auth + DB) ; prêt à déployer sur Vercel.
2. **Migrations** : créer les tables de la section 8.
3. **Librairie de prompts** : seed ~50 prompts d'intention d'achat pour beauté/compléments (section 5, module A).
4. **Boucles 1–3** (section 9) via Inngest : runner multi-LLM → juge JSON → scorer. Commencer avec 2 modèles pour limiter les coûts, puis 4.
5. **Dashboard** : courbe de visibility_score dans le temps + share-of-voice vs concurrents, filtre par modèle.
6. **Lead magnet public** (section 6) : formulaire → scan live 10 prompts → teaser + gate email → écrit `leads`.
7. **Stripe** : Checkout + 3 paliers (section 11) + webhook → `subscriptions` ; gating des quotas par plan.
8. **Digest email hebdo** (Resend) + **PostHog** sur les events clés.
9. **Déploiement Vercel** + cron quotidien.

Contraintes de qualité : local-first puis déploiement ; gérer coûts LLM (cadence par palier) ; extraction en JSON strict ; poser une question dès qu'un choix a un impact produit.
