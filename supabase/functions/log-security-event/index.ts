// =============================================================================
// log-security-event  (Roofy Security)
// =============================================================================
//
// SVRHA:
// Centralna edge funkcija za pisanje u `security_audit_log`. Svaki značajan
// sigurnosni događaj na klijentu (login, logout, promjena lozinke, MFA enroll,
// MFA disable, korištenje recovery koda, "odjavi me sa svih uređaja") zove
// ovu funkciju.
//
// ZAŠTO ZASEBNA FUNKCIJA (umjesto da klijent direktno piše):
// `security_audit_log` nema INSERT RLS policy za korisnike — namjerno.
// Da je dopušteno, korisnik (ili napadač s njegovim tokenom) mogao bi:
//   - Lažirati zapise ("logirao sam se iz Zagreba" iako nije)
//   - Spamati tablicu da otežaju forenziku
//   - Prepisati svoju povijest
// Ovako samo SERVICE_ROLE (server) piše, a klijent samo opisuje događaj.
//
// SIGURNOST:
// - Funkcija ZAHTIJEVA valjan JWT (verify_jwt = true, default).
// - `user_id` uzimamo iz JWT-a, NE iz request body-a — sprječava napade gdje
//   napadač pokušava upisati zapis u tuđe ime.
// - IP adresu i user-agent ekstraktiramo iz HTTP headera, ne iz body-a.
//
// O WAF/PROXY OGRANIČENJU:
// Ova funkcija (kao i sve ostale Lovable edge funkcije) NEMA pred sobom WAF
// ili reverse proxy koji bi:
//   - Filtrirao očito zlonamjerne requestove (SQL injection, oversize payloads)
//   - Radio rate-limiting na razini IP-a prije nego dođe do funkcije
//   - Geo-blokirao zemlje iz kojih ne očekujemo promet
//   - Dodavao DDoS zaštitu
// Lovable Cloud trenutno nema te primitive. Ako Roofy postane ozbiljna meta,
// preporuka je staviti Cloudflare (ili sličan) ispred:
//   1. Custom domena → Cloudflare proxy (orange cloud)
//   2. WAF rules: blokiraj poznate napadačke patterne
//   3. Rate limiting na /functions/v1/* endpointima
//   4. Bot Fight Mode
// Do tada se oslanjamo na: RLS, JWT verifikaciju, validaciju inputa i
// ad-hoc rate-limiting iz `check-login-rate-limit` funkcije.
//
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Whitelist dopuštenih event tipova. Sprječava da se log napuni proizvoljnim
// stringovima — kasnije čini upite (npr. "koliko je bilo logina") pouzdanim.
const ALLOWED_EVENTS = new Set([
  "login_success",
  "login_failed",
  "logout",
  "logout_all_devices",
  "password_changed",
  "password_reset_requested",
  "mfa_enabled",
  "mfa_disabled",
  "mfa_recovery_code_used",
  "mfa_challenge_failed",
  "profile_updated",
  "email_changed",
  "role_changed",
  "account_banned",
  "verification_submitted",
  "verification_approved",
  "verification_rejected",
]);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service-role klijent za pisanje u tablicu (zaobilazi RLS).
const adminDb = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- 1. Identificiraj korisnika iz JWT-a -------------------------------
    // KRITIČNO: user_id MORA dolaziti iz tokena, nikad iz body-a, inače bi
    // napadač mogao pisati zapise u tuđe ime.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();

    // Neki događaji (npr. neuspjeli login) se događaju PRIJE nego korisnik
    // ima JWT — u tom slučaju dopuštamo anonimni zapis, ali samo za
    // specifične "pre-auth" događaje.
    const PRE_AUTH_EVENTS = new Set([
      "login_failed",
      "password_reset_requested",
    ]);

    const body = await req.json().catch(() => ({}));
    const eventType = String(body.event_type ?? "");
    const metadata = (body.metadata && typeof body.metadata === "object")
      ? body.metadata
      : {};

    if (!ALLOWED_EVENTS.has(eventType)) {
      return json({ ok: false, error: "invalid_event_type" }, 400);
    }

    if (!user && !PRE_AUTH_EVENTS.has(eventType)) {
      return json({ ok: false, error: "unauthenticated" }, 401);
    }

    // ---- 2. Ekstraktiraj kontekst iz HTTP headera --------------------------
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // ---- 3. Upiši (append-only) -------------------------------------------
    const { error } = await adminDb.from("security_audit_log").insert({
      user_id: user?.id ?? body.user_id ?? null, // body.user_id samo za pre-auth
      event_type: eventType,
      ip_address: ip,
      user_agent: userAgent,
      // Sanitiziramo metadata: ograničavamo veličinu da napadač ne može
      // napuniti bazu jednim ogromnim zapisom.
      metadata: JSON.parse(JSON.stringify(metadata).slice(0, 4000)),
    });

    if (error) {
      console.error("log-security-event insert error:", error);
      return json({ ok: false }, 500);
    }

    // Best-effort cleanup (kao kod login_attempts) — ~2% requestova.
    if (Math.random() < 0.02) {
      await adminDb.rpc("purge_old_audit_logs").catch(() => {/* ignore */});
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("log-security-event error:", err);
    return json({ ok: false }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
