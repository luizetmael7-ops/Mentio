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
