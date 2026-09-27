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
  await page.getByRole("button", { name: /Ajouter à l'Index/ }).click();
  await expect(page.getByText(/rejoint la file/)).toBeVisible();
});

test("ajouter une marque : catégorie mesurée → réponse immédiate", async ({ page }) => {
  await page.goto("/ajouter");
  await page.getByLabel("La marque").fill("La Rosée");
  await page.getByLabel("Ce que ses clients cherchent").fill("Crème solaire");
  await page.getByRole("button", { name: /Ajouter à l'Index/ }).click();
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
