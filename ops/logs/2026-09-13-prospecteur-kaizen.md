# 2026-09-13 — Le Prospecteur, premier retour terrain

## Les chiffres

| | |
|---|---|
| Emails envoyés depuis le lancement | **67** |
| dont agences françaises (la cible de §1) | **20** |
| dont marques | 47 |
| dont à l'étranger | 34 |
| Réponses visibles dans la boîte | ~10, **toutes automatiques** |
| Réponses humaines positives | **0** |
| Réponses d'agences | **0** |
| Rebonds | 1 |
| Coût de la prospection | 0,00 $ |

## Ce que disait la boîte

Accusés de réception de systèmes de tickets (Pulsin « Case PUL5613 », Thorne « You
submitted a question », Paula's Choice Kundenservice, Vital Proteins, Vitabiotics
Support), réponses automatiques (Weleda, Aime), un `noreply` classé spam (Tower 28),
un rebond. Aucun humain.

## Quatre défauts trouvés en regardant la sortie réelle

1. **70 % des envois hors cible.** 47 marques, 34 à l'étranger. L'Angle et l'Expéditeur
   traitaient marques et agences à égalité ; rien n'imposait §1. → L'Expéditeur
   n'écrit plus qu'aux agences françaises (`PROSPECT_TARGETS`, `PROSPECT_COUNTRIES`).
2. **75 contacts étaient des boîtes de support.** `support@`, `customerservice@`,
   `orders@` alimentent Zendesk ou Gorgias. → bloquées.
3. **30 agences joignables sans angle.** La verticale agences a été mesurée par un script
   qui écrit l'édition sans passer par `prompt_runs` : zéro relevé, donc zéro angle de
   repli. → l'édition contient ses 196 réponses extraites, on les lit directement.
4. **Cinq questions inventées prêtes à partir.** Le prompt exigeait qu'une seconde
   phrase cite une question, même quand l'angle n'en contient aucune. Le vérificateur
   de faits, sur la même famille de modèles, les a laissées passer. → prompt corrigé,
   et contrôle `CITATION` déterministe : 11 inventions arrêtées sur 23.

## Ce qui reste cassé

**L'Oreille** : `AUTHENTICATIONFAILED` en IMAP depuis GitHub Actions, alors que les mêmes
identifiants envoient en SMTP et ouvrent le webmail. Hypothèse la plus probable : OVH
refuse les connexions IMAP depuis des IP de datacenter. À régler côté OVH ; en attendant,
la boîte se lit à la main.

**Le Baromètre des agences** n'a pas été remesuré depuis le 13 août. L'Éditeur ne
produit que la verticale beauté (éditions du 30 août et du 6 septembre).

## Ce que ça veut dire

Le test de l'ICP n'a pas encore eu lieu. Vingt emails à des agences, dont une partie
sur des structures qui n'en sont pas (Oxeva est un hébergeur, Reech une plateforme
d'influence), ne mesurent rien. Les 47 envois aux marques, eux, ont confirmé §1
gratuitement.

L'approbation automatique a laissé passer les défauts 1 et 4. Aucun des deux n'aurait
survécu à la lecture de cinq emails par un humain.

## Coût

0,00 $.
