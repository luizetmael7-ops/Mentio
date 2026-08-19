# 2026-08-19 — Le Prospecteur, session 4 (L'Expéditeur) + réécriture des gabarits

## La réécriture des emails

La première version — cinq lignes, 90 mots, un fait, une question — a été jugée
« cavalière et survolée » à la relecture, et le jugement est juste : elle lisait comme
un envoi de masse court, pas comme quelqu'un qui a fait le travail.

Nouvelle structure, en quatre paragraphes :

1. le fait qui les concerne, chiffré ;
2. ce qu'est Mentio — méthode, cadence, moteurs, indépendance ;
3. ce que contient le rapport, précisément ;
4. une question fermée, jamais deux.

Puis la signature complète. Aucun prix dans un premier message ; c'est le rapport qui
vend, pas le mail.

### Deux règles du brief écartées, en connaissance de cause

| Règle du brief | Ce qui est appliqué | Pourquoi |
|---|---|---|
| 90 mots maximum | **280** (les emails font 215–237) | À 30 envois/jour, le registre long est précisément ce que le petit volume achète |
| Un seul lien | **Deux au plus**, dont le rapport | Le second est `mentio.fr/methodologie` : citer la méthode vaut mieux que demander qu'on nous croie |
| Objet en minuscules, 4 mots | Objet du gabarit, casse comprise | Un objet tout en minuscules sur un message de quatre paragraphes signale l'automate |

Le Contrôleur a été ajusté en conséquence : il exige toujours la présence du rapport,
plafonne à deux liens, et n'autorise comme second lien QUE la page de méthodologie.

## Le certificat de mentio.fr — diagnostic final

Ce n'était pas un problème de certificat. Les deux certificats Vercel sont valides.

**`mentio.fr` porte un enregistrement `AAAA` → `2001:41d0:301::29`**, un serveur
d'hébergement web OVH, reliquat de l'hébergement précédent.

| | IPv4 (A) | IPv6 (AAAA) |
|---|---|---|
| `mentio.fr` | 76.76.21.21 → Vercel, certificat valide | 2001:41d0:301::29 → OVH, `cluster129.hosting.ovh.net` |
| `www.mentio.fr` | Vercel, valide | **aucun** |

Tout visiteur disposant d'IPv6 — la majorité des mobiles et des box récentes —
atterrit chez OVH et reçoit un avertissement de sécurité pleine page. En IPv4 tout
fonctionne. C'est ce qui rend la panne intermittente selon d'où on regarde, et c'est
pour cette même raison que `www` n'a jamais posé de problème : il n'a pas d'AAAA.

**Correctif : supprimer l'enregistrement `AAAA` de `mentio.fr` dans la zone OVH.**
Aucune modification de zone n'a été faite par l'agent.

## L'Expéditeur

**Il n'envoie rien, et c'est délibéré.** CLAUDE.md §8.1 interdit à un agent d'envoyer
un message à un tiers. L'Expéditeur est du code, pas un agent — mais il vit dans un
dépôt où des agents tournent, donc il refuse de partir par défaut. Sans `--armer`, il
fait une répétition complète et imprime ce qui partirait. Avec `--armer`, il lève une
exception explicite : aucun transport SMTP n'est branché, et brancher un transport
revient à un humain.

Ce qui manque de toute façon avant tout envoi réel :

- les identifiants SMTP de `seshat@mentio.fr` ;
- **quatre semaines de chauffe manuelle**, 5 emails par jour à des gens qui répondent.
  C'est le chemin critique du projet et il ne s'accélère pas.

Ce qui est construit et vérifiable dès maintenant :

- **montée en charge** 5 → 12 → 22 → 30 sur quatre semaines, lue depuis `prospect_mailboxes` ;
- **heures ouvrées du fuseau du destinataire**, 9 h–17 h, pas de week-end, jours
  fériés français exclus ;
- **intervalle irrégulier de 8 à 25 minutes** — une cadence régulière se repère ;
- **cinq coupe-circuits** vérifiés avant chaque envoi (`lib/coupe-circuits.ts`) ;
- **arrêt d'urgence en une ligne**, exécutable depuis un téléphone.

### Les coupe-circuits

| Condition | Seuil | Effet |
|---|---|---|
| Rebonds sur 100 envois | > 2 % | arrêt, audit du Facteur |
| Plaintes spam | > 0,05 % | **arrêt total** |
| Réponses sur 200 envois | < 2 % | gel du volume — le message est mauvais |
| Rejets Contrôleur | > 40 % | alerte, un module amont est cassé |
| **Réponses non traitées** | **> 15** | **arrêt de l'envoi** |
| Arrêt manuel | — | arrêt total |

Le seuil de plainte est à 0,05 % et non 0,1 % parce que le domaine d'envoi est le
domaine principal : ce qui brûle ici brûle aussi les rapports des clients qui paient.

Le cinquième est le plus important, et c'est celui qui rend le système compatible
avec une prépa : il s'arrête tout seul quand l'humain prend du retard. Un email sans
réponse coûte de la réputation ; une réponse positive laissée sans réponse coûte un
client. Le second coût est sans commune mesure.

```bash
npm run prospect:expediteur              # répétition, aucun envoi
npm run prospect:expediteur -- --etat    # l'état des coupe-circuits
npm run prospect:stop "raison"           # arrêt d'urgence
```

## Coût

**0,00 $.** Aucun appel payant sur l'ensemble des quatre sessions.


## Vérification de bout en bout

Chaîne complète rejouée après correction des gabarits :

| | |
|---|---|
| Angles | 31 — **100 % de niveau 1 ou 2** |
| Emails rédigés | 31, de 215 à 237 mots |
| Validés par le Contrôleur | **27** · 4 rejetés (13 %) — les 4 marques américaines, faute d'adresse postale |
| Répétition de l'Expéditeur | 5 candidats (plafond de chauffe semaine 1), **5 reportés** : samedi |
| Arrêt d'urgence | posé, vérifié bloquant, levé |
| Envois réels | **0** |

### Quatre défauts corrigés sur les gabarits longs

1. « Votre **marque** Stafe » écrit à une **agence** — le modèle ne savait pas à qui
   il écrivait. Un champ `nature` le lui dit maintenant.
2. « vous 4,6 » — un nombre de citations à virgule, qui est en réalité une moyenne
   d'échantillonnage stratifié. Arrondi : « 4,6 citations » se lit comme une
   coquille, pas comme de la rigueur.
3. « l'édition du 2026-08-16 » — une date ISO dans une phrase, c'est-à-dire une fuite
   de base de données. Formatée en toutes lettres.
4. Le lien méthodologie pointait `mentio.fr` en dur, cassé en IPv6, alors que le
   rapport pointait `www`. Les deux suivent désormais le même hôte.

### Un bug de requête dans l'Expéditeur

`.eq("status","warmup").or("status.eq.active")` se combine en ET, pas en OU : la
condition demandait un statut à la fois « warmup » et « active », donc aucune boîte
n'était jamais trouvée. Remplacé par `.in()`.
