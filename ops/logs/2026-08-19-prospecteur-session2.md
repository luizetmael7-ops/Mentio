# 2026-08-19 — Le Prospecteur, session 2 (Le Facteur)

## Le point qui a tout déterminé

Pas de VPS, et la contrainte reste 0 €. Donc **pas de vérification SMTP** : depuis
une connexion résidentielle le port 25 est bloqué par le FAI, et quand il ne l'est
pas l'IP est déjà sur les listes noires. Le brief comptait sur un VPS OVH — c'est
l'avantage qu'OVH garde sur AWS, GCP et Azure, qui bloquent tous le port 25 sortant.

Les quatre étiquettes envoyables du brief supposaient toutes un « SMTP OK ». On n'a
pas gardé leurs noms en changeant leur sens : une étiquette qui ment sur ce qu'elle
prouve fait envoyer un email à une mauvaise adresse six mois plus tard, quand plus
personne ne se souvient du compromis.

| Étiquette | Preuve | Envoyable |
|---|---|---|
| `onsite_named` | adresse nominative publiée par l'entreprise + MX | ✅ |
| `onsite_role` | `contact@` publiée par l'entreprise + MX | ✅ |
| `pattern_unverified` | déduite du motif maison — c'est le SMTP qui la validait | ❌ |
| `guessed_unverified` · `no_mx` · `blocked` | — | ❌ |

Ce qu'on perd : l'existence de la boîte, et la détection du catch-all. Ce qu'on
garde : l'entreprise a **choisi de publier** cette adresse, et son domaine sait
recevoir du courrier (MX en DNS, aucun port 25 nécessaire).

## Résultats — 33 domaines

| | |
|---|---|
| Domaines parcourus | 33 (**247 pages**, 8 max par domaine) |
| Avec au moins une adresse | 18 — **55 % de taux d'adresse** (cible du brief : 55–65 %) |
| Adresses envoyables | **30** — 2 nominatives, 28 de fonction |
| Écartées | 8 (`dpo@`, `press@`, `accounting@`, `testimonials@`…) |
| Échecs | 1 pare-feu, 14 sans adresse, 0 refusé par robots.txt |
| Motifs maison déduits | 2 (`prenom.nom`, `prenom-nom`) — collectés, non envoyables |
| Coût | **0,00 $ — aucun appel LLM dans ce module** |

Marques joignables : 6 FR, 10 US, 2 GB.

**Le brief avait raison sur les pages légales.** Sur les 30 adresses envoyables, huit
viennent d'une page imposée par la loi et non de `/contact` : les quatre adresses de
Markal sortent de `/annexes/mentions-legales`, celles de GoodBelly, VSL#3,
builtvisible, Drunk Elephant et Vintner's Daughter de leur page de confidentialité.
Le RGPD oblige à y publier un contact, personne ne les regarde.

## Six défauts trouvés en faisant tourner

Aucun n'était visible avant l'exécution.

1. **Chemins devinés inutiles.** `nutriandco.com` publie sur `/fr/pages/mentions-legales`,
   `markal.fr` sur `/annexes/mentions-legales`. Aucune liste ne trouve ça. Le Facteur
   lit la page d'accueil et **suit les liens que le site désigne lui-même**, avec les
   chemins conventionnels en repli seulement.
2. **Adresses dans les blocs `<script>`.** `contact@luxeol.com`, `bonjour@nutriandco.com`
   vivent dans la configuration JSON du thème Shopify. La première version supprimait
   les scripts avant de chercher.
3. **Noms de fichiers pris pour des adresses.** `salesforce@320w.avif` — 72 sur une
   seule page de `primelis.com`.
4. **Adresses d'exemple de formulaire.** `name@mail.com` sur vsl3.com,
   `john@coolbusiness.com` sur riseatseven.com. Parfaitement valides, à personne.
5. **Échappement JSON.** `u003eprivacy@thorne.com`, artefact d'un `>` collé.
6. **Repli hors-domaine trop large.** Le site de Nature's Way rendait
   `info@stagheaddesigns.com`, une entreprise sans rapport ; celui de Markal
   `contact@creasens.fr`, son agence web. Règle retenue : à défaut d'adresse au
   domaine de la marque, on ne garde qu'une messagerie grand public (le cas TPE, où
   le Gmail est la vraie boîte) ou un domaine portant le nom de la marque
   (`vsl3usa.com` pour VSL#3).

Deux erreurs de classement corrigées à la main plutôt que par un troisième crawl :
`support-fr@` n'est pas un nom de personne, `guillaume@` en est un. Le code est
corrigé pour les prochains passages — recrawler 33 sites pour deux étiquettes aurait
été impoli pour un gain cosmétique.

## Écart assumé avec le brief

**Le « Décideur » (Pappers, Companies House) n'est pas construit.** Aucun MCP Pappers
n'est connecté, pas de clé Companies House — mais surtout le brief lui-même dit de ne
l'appeler que sur les prospects dont l'angle est de niveau 1 ou 2. Cet angle n'existe
pas avant la session 3 : l'appeler maintenant brûlerait un quota gratuit limité sur
des prospects non qualifiés. À faire en session 3, après l'Angle.

## À vérifier avant la session 3

- **`/rapport/[slug]` doit répondre 200 pour une marque de prospection.** Le
  Contrôleur en fait une condition d'envoi. Les pages actuelles sont adossées aux
  marques clientes, pas au vivier : à vérifier avant d'écrire l'Angle.
- **L'angle « palier » est en conflit avec CLAUDE.md §3.** Un scan de prospection
  n'est pas un Score Mentio — le brief le dit lui-même — donc annoncer un palier
  depuis une mesure dégradée diluerait le barème, qui est l'actif. À trancher.
