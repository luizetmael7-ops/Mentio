-- DEUX NIVEAUX DE MESURE, séparés dans le schéma.
--
-- Le constat qui l'impose : le Semeur découvre plus vite que le Baromètre ne mesure.
-- Sur 61 marques découvertes, 8 étaient classées — l'Angle ne pouvait rien écrire aux
-- 53 autres. Le goulot ne limitait pas la qualité, il divisait le débit par deux.
--
-- Or les 989 mentions déjà en base contiennent des faits vérifiables sur des marques
-- NON classées : « citée 3 fois quand une autre l'est 22 fois » est vrai, mesuré, et
-- daté, sans qu'aucun Score Mentio n'ait été calculé pour elle.
--
--   'edition' : 4 moteurs avec recherche web. SEULE source autorisée pour un Score
--               Mentio, un palier, un badge, une page publique.
--   'releve'  : modèles gratuits ou agrégats de mentions. Prospection uniquement.
--
-- La règle qui rend ça honnête, et qui protège l'actif de catégorie (CLAUDE.md §3) :
-- un angle de niveau 'releve' autorise des affirmations de COMPTAGE, jamais de SCORE
-- ni de palier. « Vous apparaissez 0 fois sur 10 questions » est robuste au choix du
-- modèle ; « vous êtes à 12/100, palier Aperçue » ne l'est pas.

alter table public.prospect_angles drop constraint prospect_angles_type_check;

alter table public.prospect_angles add constraint prospect_angles_type_check
  check (type in (
    -- Angles adossés à une ÉDITION publiée : score et palier autorisés
    'depassement_nomme', 'question_perdue', 'domaine_a_conquerir', 'palier',
    -- Angles adossés à un RELEVÉ : comptage seulement
    'concurrent_cite',    -- citée N fois, une autre M fois, sur les mêmes questions
    'absente_secteur',    -- absente des N questions de sa verticale — le plus fort
    'domaines_sources',   -- les domaines que les modèles lisent dans ce secteur
    'no_angle'
  ));

alter table public.prospect_angles
  add column source_level text not null default 'edition'
    check (source_level in ('edition', 'releve'));

-- La contrainte est en base et non dans le code : un module réécrit dans six mois
-- ne pourra pas produire un palier depuis un comptage gratuit sans que PostgreSQL
-- le refuse. C'est le barème qu'on protège, et il ne se rattrape pas.
alter table public.prospect_angles add constraint prospect_angles_niveau_coherent
  check (
    (source_level = 'edition')
    or (type in ('concurrent_cite', 'absente_secteur', 'domaines_sources', 'no_angle'))
  );

create index idx_prospect_angles_niveau on public.prospect_angles (source_level, type);

-- Une marque dont la verticale n'est pas couverte n'est pas un échec : elle attend.
-- Elle reste au vivier sans consommer ni Facteur ni Angle.
alter table public.prospect_brands
  add column coverage_status text not null default 'inconnu'
    check (coverage_status in ('inconnu', 'couverte', 'en_attente_de_couverture'));

create index idx_prospect_brands_couverture on public.prospect_brands (coverage_status)
  where excluded = false;
