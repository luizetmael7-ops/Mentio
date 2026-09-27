import { test, expect, type Page } from "@playwright/test";

/**
 * Les parcours qui rapportent — et les règles qui ne se discutent pas.
 * Données de démonstration : l'étude réelle de juillet, plus une édition
 * volontairement défectueuse (« Gemini seul ») qui ne doit apparaître nulle part.
 */

/** Constitution §6 : des mots collés trahissent le piège du transform JSX. */
async function expectNoGluedWords(page: Page) {
  const html = await page.content();
  expect(html.match(/[a-zA-Z]{2,}<!-- -->[a-zA-Z]{2,}/g) ?? []).toEqual([]);
}

/** Constitution §6 : lisible à 380 px, sans défilement horizontal. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("accueil : un classement réel, pas l'édition défectueuse", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("En direct de l'Index")).toBeVisible();
  // L'édition du 6 septembre (Gemini seul) est écartée : c'est celle du 23 août qui est servie.
  await expect(page.getByText("23 août 2026").first()).toBeVisible();
  await expect(page.getByText("6 septembre 2026")).toHaveCount(0);
  await expectNoGluedWords(page);
  await expectNoHorizontalScroll(page);
});

test("scan gratuit : score, puis détail débloqué par email", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Le nom de votre marque").fill("Typology");
  await page.getByPlaceholder("Votre secteur").fill("beauté");
  await page.getByRole("button", { name: /Obtenir mon score/ }).click();
  await expect(page).toHaveURL(/\/scan\/demo-typology/);
  await expect(page.getByText("Voir votre score exact et le détail")).toBeVisible();
  await page.getByPlaceholder("vous@votremarque.fr").fill("test@exemple.fr");
  await page.getByRole("button", { name: "Voir le rapport" }).click();
  await expect(page.getByText(/Score \d+\/100/)).toBeVisible();
});

test("l'Index : la recherche trouve une marque et un secteur", async ({ page }) => {
  await page.goto("/classements");
  const search = page.getByLabel("Chercher une catégorie ou une marque");
  await search.fill("Typology");
  await expect(page.getByRole("link", { name: /Beauté, soin & compléments/ }).first()).toBeVisible();
  await search.fill("zzzz introuvable");
  await expect(page.getByRole("link", { name: "demandez-la" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("ajouter une marque : catégorie inconnue → file d'attente", async ({ page }) => {
  await page.goto("/ajouter");
  await page.getByLabel("La marque").fill("Marque Test");
  await page.getByLabel("Ce que ses clients cherchent").fill("matelas en latex");
  await page.getByRole("button", { name: "Rejoindre la file" }).click();
  await expect(page.getByText(/rejoint la file/)).toBeVisible();
});

test("ajouter une marque : catégorie mesurée → réponse immédiate", async ({ page }) => {
  await page.goto("/ajouter");
  await page.getByLabel("La marque").fill("La Rosée");
  await page.getByLabel("Ce que ses clients cherchent").fill("Crème solaire");
  await page.getByRole("button", { name: "Rejoindre la file" }).click();
  await expect(page).toHaveURL(/\/marques\/la-rosee/);
});

test("marchés fermés : ni l'Allemagne, ni l'Autriche, ni le Canada", async ({ page, request }) => {
  await page.goto("/ajouter");
  const options = await page.locator("#req-country option").allTextContents();
  expect(options.join(" ")).not.toMatch(/Allemagne|Autriche|Canada/);
  const api = await (await request.get("/api/v1/index")).json();
  for (const c of api.categories) expect(["DE", "AT", "CA"]).not.toContain(c.country);
});

test("« c'est ma marque » : la revendication aboutit", async ({ page }) => {
  await page.goto("/marques/la-roche-posay");
  const email = page.getByPlaceholder("vous@votremarque.fr").first();
  await email.scrollIntoViewIfNeeded();
  await email.fill("marque@exemple.fr");
  await email.press("Enter");
  await expect(page.getByText(/est revendiquée|C'est noté/)).toBeVisible();
});

test("méthodologie : l'erratum publie l'édition écartée", async ({ page }) => {
  await page.goto("/methodologie#erratum");
  await expect(page.locator("#erratum")).toContainText("6 septembre 2026");
  await expect(page.locator("#erratum")).toContainText("chatgpt");
});

test("cockpit : réservé, redirige vers la connexion", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(page.url()).toContain("/login");
  expect(response?.status()).toBeLessThan(500);
});

test("mesure prioritaire : du formulaire au rapport livré, avec l'offre de suivi", async ({ page }) => {
  await page.goto("/ajouter");
  // Les deux options, avec leur vrai délai et la règle qui ne se vend pas.
  await expect(page.getByText("File publique")).toBeVisible();
  await expect(page.getByText(/Vous payez la date de la mesure, jamais son résultat/).first()).toBeVisible();
  await page.getByLabel("La marque").fill("Soleil Test");
  await page.getByLabel("Ce que ses clients cherchent").fill("crème solaire");
  await page.getByRole("button", { name: /Mesurer maintenant/ }).click();
  await expect(page).toHaveURL(/\/commande\/demo/);
  await expect(page.getByRole("heading", { name: "Soleil Test", exact: true })).toBeVisible();
  await expectNoGluedWords(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: /Ouvrir le rapport/ }).click();
  await expect(page).toHaveURL(/\/rapport\/c\/demo/);
  await expect(page.getByRole("heading", { name: "Soleil Test", exact: true })).toBeVisible();
  // Une marque absente a un rapport quand même : c'est un diagnostic, pas une page blanche.
  await expect(page.getByRole("button", { name: /Suivre Soleil Test — 19 € par mois/ })).toBeVisible();
  await expectNoGluedWords(page);
  await expectNoHorizontalScroll(page);
});

test("tarifs : quatre offres, rien d'inventé autour", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("article", { name: /^Offre / })).toHaveCount(4);
  await expect(page.getByText(/le plus choisi/i)).toHaveCount(0);
  await expect(page.locator(".line-through")).toHaveCount(0);
  await expect(page.getByText("449")).toHaveCount(0);
  await expectNoGluedWords(page);
  await expectNoHorizontalScroll(page);
});

test("widget agence : un test donne un palier du barème public", async ({ page }) => {
  await page.goto("/w/demo");
  await page.getByLabel("Votre marque").fill("La Rosée");
  await page.getByLabel("Ce que cherchent vos clients").fill("crème solaire bio");
  await page.getByRole("button", { name: /Suis-je recommandé/ }).click();
  await expect(page.getByRole("status")).toContainText("La Rosée est");
  await expect(page.getByRole("status")).toContainText("/100");
  await expect(page.getByText("Mesuré par")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("widget agence : une ligne de code sur une page quelconque suffit", async ({ page, baseURL }) => {
  await page.setContent(
    `<!doctype html><html><body><h1>Le site d'une agence</h1><div id="mentio-widget"></div>` +
      `<script src="${baseURL}/widget.js" data-agence="demo" async></script></body></html>`
  );
  const frame = page.frameLocator('iframe[title="Test de visibilité IA"]');
  await expect(frame.getByRole("heading", { name: /Les IA recommandent-elles votre marque/ })).toBeVisible();
});

test("espace agence : réservé, redirige vers la connexion", async ({ page }) => {
  const response = await page.goto("/agence");
  expect(page.url()).toContain("/login");
  expect(response?.status()).toBeLessThan(500);
});

test("accueil : une vraie réponse de ChatGPT, et les marques qu'on y lit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Voici ce que Mentio en lit")).toBeVisible();
  await expect(page.locator("mark.lecture-mark")).toHaveCount(11);
  await expectNoGluedWords(page);
  await expectNoHorizontalScroll(page);
});

test("statut : public, daté, et les ratés affichés", async ({ page }) => {
  await page.goto("/statut");
  await expect(page.getByRole("heading", { name: /Les moteurs mesurés/ })).toBeVisible();
  // L'édition défectueuse de démonstration (Gemini seul, 6 septembre) est listée, pas cachée.
  await expect(page.getByText(/6 septembre 2026/).first()).toBeVisible();
  await expectNoGluedWords(page);
  await expectNoHorizontalScroll(page);
});

test("serveur MCP : un assistant peut lire l'Index", async ({ request }) => {
  const rpc = (method: string, params: object = {}, id = 1) =>
    request.post("/api/mcp", { data: { jsonrpc: "2.0", id, method, params } }).then((r) => r.json());
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  expect(init.result.serverInfo.name).toBe("mentio-index");
  const list = await rpc("tools/list");
  expect(list.result.tools.map((t: { name: string }) => t.name)).toContain("get_category_ranking");
  const ranking = await rpc("tools/call", { name: "get_category_ranking", arguments: { category: "crème solaire", country: "FR" } });
  expect(ranking.result.content[0].text).toMatch(/\/100/);
  expect(ranking.result.content[0].text).toContain("mentio.fr");
  const unknown = await rpc("tools/call", { name: "nope", arguments: {} });
  expect(unknown.error.code).toBe(-32602);
});

test("partage : carrousel PDF et image d'une catégorie publiée", async ({ request }) => {
  const pdf = await request.get("/api/carrousel/barometre");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const missing = await request.get("/api/carrousel/categorie-inexistante-fr");
  expect(missing.status()).toBe(404);
  const og = await request.get("/barometre/opengraph-image");
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("Radar : le récepteur ne gêne jamais une page", async ({ request }) => {
  const ok = await request.post("/api/signal", { data: { kind: "marque", subject: "la-roche-posay" } });
  expect(ok.status()).toBe(204);
  const junk = await request.post("/api/signal", { data: "pas du json" });
  expect(junk.status()).toBe(204);
});
