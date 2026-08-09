# Cibles agences — SEO / growth France

**Pourquoi les agences et plus les marques.** Après 100 marques démarchées en DM
Instagram et zéro client : le DM d'une marque est lu par un community manager, sans
budget ni KPI sur la visibilité IA. Une agence a une ligne budgétaire outil, un
décideur joignable par email, et une raison d'acheter — vendre un retainer GEO.
Bénéfice de bord : une agence apporte 10 à 30 marques au Baromètre.

## Comment remplir ce fichier

Une ligne par agence. Le générateur (`scripts/build-agency-outreach.ts`) produit
l'email et le lien de rapport à partir de ces colonnes.

| Colonne | Ce qu'on met | Comment le trouver |
|---|---|---|
| `agence` | Le nom commercial | — |
| `contact` | Prénom du décideur | LinkedIn, page « équipe » du site |
| `email` | `prenom@agence.fr` devine juste 8 fois sur 10 | site, ou format déduit |
| `client` | **Une marque qu'elle accompagne, présente au Baromètre** | études de cas, page références |
| `slug` | L'identifiant Mentio de ce client | `mentio.fr/barometre`, colonne marque |
| `couleur` | Hex de leur charte, sans le `#` | logo, ou laisser vide |

**La colonne `client` est celle qui fait tout le travail.** Un email qui nomme un
client de l'agence et lui montre son score est lu ; un email générique ne l'est pas.
Croiser leurs références avec les 50 marques du Baromètre prend deux minutes par
agence, et c'est là que se joue le taux de réponse.

## Où trouver 60 agences en deux heures

- Les auteurs de contenu GEO / AEO sur LinkedIn — ils sont déjà convaincus du sujet.
- Les agences citées dans les baromètres SEO français annuels.
- Les membres des communautés growth francophones.
- Les agences dont les clients apparaissent déjà dans notre Baromètre : commencer
  par celles-là, l'accroche est immédiate.

## La liste

À compléter à la main. Le format doit être exactement celui-ci — le générateur lit
les colonnes dans cet ordre.

| agence | contact | email | client | slug | couleur |
|---|---|---|---|---|---|
| | | | | | |

<!--
EXEMPLE de ligne remplie, à supprimer une fois la vraie liste écrite :
| Studio GEO | Camille | camille@studiogeo.fr | Typology | typology | 2FA98A |
-->

## L'ordre d'envoi

20 emails par semaine, à la main, jamais automatisés. Un message sincère envoyé
par un humain convertit ; le même envoyé par un robot est du spam, et c'est
précisément la sincérité qui fonctionne ici.

Commencer par les agences dont un client est **mal classé** au Baromètre : l'écart
est le sujet de l'email.
