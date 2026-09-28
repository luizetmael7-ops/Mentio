import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fixturesEnabled } from "@/lib/fixtures";
import { SIGNAL_KINDS, isBot, type SignalKind } from "@/lib/radar";

/**
 * Le récepteur du Radar. Reçoit { kind, subject } depuis le navigateur, ignore les
 * robots, hache le visiteur avec le jour (aucun cookie, aucune IP stockée) et
 * n'enregistre qu'un signal par visiteur, sujet et type toutes les six heures.
 * Répond toujours 204 : un signal perdu ne doit jamais gêner une page.
 */
const SUBJECT = /^[a-z0-9][a-z0-9:-]{1,79}$/;

export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  if (fixturesEnabled()) return done;
  const ua = request.headers.get("user-agent");
  if (isBot(ua) || request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return done;

  let body: { kind?: unknown; subject?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return done;
  }
  const kind = body.kind as SignalKind;
  const subject = typeof body.subject === "string" ? body.subject.toLowerCase() : "";
  if (!SIGNAL_KINDS.includes(kind) || !SUBJECT.test(subject)) return done;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.RADAR_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? "mentio";
  const visitor = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 24);

  try {
    const admin = supabaseAdmin();
    const { count } = await admin
      .from("signals")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .eq("subject", subject)
      .eq("visitor", visitor)
      .gte("created_at", new Date(Date.now() - 6 * 3_600_000).toISOString());
    if ((count ?? 0) === 0) await admin.from("signals").insert({ kind, subject, visitor });
  } catch {
    // table absente ou base injoignable : le signal est perdu, la page ne l'est pas
  }
  return done;
}
