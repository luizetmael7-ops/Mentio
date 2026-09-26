-- ============================================================================
-- LE SEMIS DE L'INDEX — les premières catégories, choisies à la main.
--
-- Elles entrent en file (`queued`) sans questions : le Planificateur les envoie
-- au Cartographe (gratuit), qui écrit et fige leurs 10 questions, puis les
-- mesure au rythme du budget. Rien n'est dépensé par ce fichier.
--
-- Le choix : des intentions d'achat étroites, où l'on demande réellement à une IA
-- « laquelle choisir », et où une agence a des clients. Les agences par ville
-- passent devant (priorité 1) : c'est le seul canal qui a déjà produit un lead
-- entrant, et chaque agence classée est un acheteur potentiel.
--
-- Cadence 60 jours pour le semis : avec le plafond mensuel par défaut (8 $), les
-- deux Baromètres historiques (50 questions, mensuels) en prennent la moitié ;
-- une cadence bimestrielle permet de faire vivre une vingtaine de catégories de
-- plus avec le reste. Chaque client payant relève ce plafond.
-- ============================================================================

insert into public.index_categories
  (key, slug, label, country, language, sector, audience, status, origin, cadence_days, priority)
values
  -- Agences, par ville : l'acheteur de Mentio, et sa propre douleur
  ('fr:agence-seo-paris', 'agence-seo-paris-fr', 'Agence SEO à Paris', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 1),
  ('fr:agence-seo-lyon', 'agence-seo-lyon-fr', 'Agence SEO à Lyon', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 1),
  ('fr:agence-seo-bordeaux', 'agence-seo-bordeaux-fr', 'Agence SEO à Bordeaux', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 1),
  ('fr:agence-web-nantes', 'agence-web-nantes-fr', 'Agence web à Nantes', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 0),
  ('fr:agence-marketing-marseille', 'agence-marketing-marseille-fr', 'Agence marketing à Marseille', 'FR', 'fr', 'services', 'tape un dirigeant qui cherche un prestataire', 'queued', 'founder', 60, 0),

  -- France, consommation : des catégories où les agences ont des clients
  ('fr:creme-solaire', 'creme-solaire-fr', 'Crème solaire', 'FR', 'fr', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:serum-visage', 'serum-visage-fr', 'Sérum visage', 'FR', 'fr', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:magnesium', 'magnesium-fr', 'Magnésium', 'FR', 'fr', 'sante', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:matelas', 'matelas-fr', 'Matelas', 'FR', 'fr', 'maison', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:mutuelle-sante', 'mutuelle-sante-fr', 'Mutuelle santé', 'FR', 'fr', 'assurance', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:banque-en-ligne', 'banque-en-ligne-fr', 'Banque en ligne', 'FR', 'fr', 'finance', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:logiciel-facturation', 'logiciel-facturation-fr', 'Logiciel de facturation', 'FR', 'fr', 'saas', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:chaussures-running', 'chaussures-running-fr', 'Chaussures de running', 'FR', 'fr', 'sport', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('fr:croquettes-chien', 'croquettes-chien-fr', 'Croquettes pour chien', 'FR', 'fr', 'alimentation', 'tapent les acheteurs', 'queued', 'founder', 60, 0),

  -- L'international : la même échelle, les questions dans la langue du marché
  -- (l'interface reste en français : « audience » est une tournure de la page)
  ('us:crm-software', 'crm-software-us', 'CRM software', 'US', 'en', 'saas', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('us:project-management-software', 'project-management-software-us', 'Project management software', 'US', 'en', 'saas', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('us:running-shoes', 'running-shoes-us', 'Running shoes', 'US', 'en', 'sport', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('gb:mattress', 'mattress-gb', 'Mattress', 'GB', 'en', 'maison', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('de:sonnencreme', 'sonnencreme-de', 'Sonnencreme', 'DE', 'de', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0),
  ('es:crema-solar', 'crema-solar-es', 'Crema solar', 'ES', 'es', 'beaute', 'tapent les acheteurs', 'queued', 'founder', 60, 0)
on conflict (key) do nothing;
