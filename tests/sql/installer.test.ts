/**
 * L'installeur SQL, exécuté sur un vrai Postgres (PGlite), après TOUTES les
 * migrations depuis la première. Prouve trois choses avant que le fondateur ne
 * colle quoi que ce soit dans Supabase :
 *   1. il passe, deux fois de suite ;
 *   2. il ne modifie aucune édition publiée (empreinte identique) ;
 *   3. les marchés fermés sont refusés par la base elle-même.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DIR = join(process.cwd(), "supabase/migrations");

test("installeur : passe deux fois, n'altère aucune édition, ferme DE/AT/CA", async () => {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create role anon; create role authenticated;
  `);
  for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql") && f < "20260926000008").sort()) {
    await db.exec(readFileSync(join(DIR, f), "utf-8"));
  }
  // Les tables créées à la main en production existent déjà (cas réel)
  await db.exec(`
    create table public.contact_messages (id uuid primary key default gen_random_uuid(), kind text not null, email text not null, brand text, message text not null, created_at timestamptz default now());
    create table public.llm_spend (id uuid primary key default gen_random_uuid(), day date not null default current_date, bucket text not null, cost_usd numeric not null, calls int default 1);
  `);
  const editions: Array<[string, unknown]> = [
    ["2026-08-23", { runs: 4, models: ["chatgpt", "gemini"], topBrands: [{ name: "A", total: 2 }], answers: [{ model: "chatgpt" }, { model: "chatgpt" }, { model: "gemini" }, { model: "gemini" }] }],
    ["2026-09-06", { runs: 2, models: ["chatgpt", "gemini"], topBrands: [{ name: "A", total: 2 }], answers: [{ model: "gemini" }, { model: "gemini" }] }],
    ["2026-07-17", { runs: 100, models: ["chatgpt", "gemini"], topBrands: [{ name: "A", total: 9 }] }],
    ["2026-07-01", { runs: 1, models: ["gemini"], topBrands: [], answers: "scalaire" }],
  ];
  for (const [date, data] of editions) {
    await db.query("insert into public.index_editions (edition_date, vertical, data) values ($1, 'beaute_complements', $2)", [date, data]);
  }
  const fingerprint = async () =>
    (await db.query<{ h: string }>("select md5(string_agg(id::text || edition_date || vertical || data::text, '|' order by id)) h from public.index_editions")).rows[0].h;
  const before = await fingerprint();

  const installer = readFileSync(join(process.cwd(), "supabase/INSTALLER.sql"), "utf-8");
  await db.exec(installer);
  await db.exec(installer);

  assert.equal(await fingerprint(), before, "les éditions publiées ont changé");

  const summary = (await db.query<{ edition_date: Date; answered_by_model: Record<string, number> | null }>(
    "select edition_date, answered_by_model from public.index_editions_summary order by edition_date"
  )).rows;
  assert.deepEqual(summary.find((r) => r.edition_date.toISOString().startsWith("2026-09-06"))?.answered_by_model, { gemini: 2 });

  for (const sql of [
    "insert into public.index_categories (key, slug, label, country, language) values ('de:x','x-de','X','DE','de')",
    "insert into public.index_requests (brand_name, country, category_input) values ('Acme','AT','creme')",
    "insert into public.orders (kind, brand_name, country, category_input) values ('priority','Acme','CA','creme')",
  ]) {
    await assert.rejects(db.exec(sql), /check constraint/);
  }
  const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.index_categories where country in ('DE','AT','CA')");
  assert.equal(rows[0].n, 0);
  await db.close();
});
