// =============================================================================
// check-login-rate-limit  (Roofy Security)
// =============================================================================
//
// SVRHA:
// Edge funkcija koja se POZIVA PRIJE `supabase.auth.signInWithPassword()` na
// klijentu. Provjerava je li određena (email + IP) kombinacija premašila
// dopušteni broj neuspjelih pokušaja prijave u kliznom prozoru.
//
// ZAŠTO OVAKO (umjesto pravog WAF-a):
// Lovable backend trenutno NEMA ugrađene primitive za rate-limiting na razini
// transporta (npr. Cloudflare/edge proxy). Ovo je ad-hoc rješenje:
//   - radi protiv "credential stuffing" i klasičnih brute-force napada
//   - NE štiti od distribuiranog napada (botnet s tisuću različitih IP-ova)
//     — za tu razinu zaštite treba pravi proxy ispred aplikacije.
//
// PRAVILA (lako se mijenjaju u konstantama dolje):
//   - 5 neuspjelih pokušaja u 15 min po (email+IP)  → blokada 15 min
//   - 20 neuspjelih po samo IP-u u 15 min            → blokada IP-a 15 min
//     (štiti od napada gdje napadač varira email)
//   - Uspješan login NE briše povijest (samo logira success=true) — namjerno,
//     da znamo kad je netko bio "blizu" ali pogodio na 4. pokušaju.
//
// FLOW NA KLIJENTU:
//   1. Korisnik klikne "Prijavi se"
//   2. Klijent zove `check-login-rate-limit` s emailom
//   3. Ako odgovor kaže `blocked: true` → prikaži poruku, NE zovi Supabase auth
//   4. Inače → pozovi `signInWithPassword`
//   5. Bez obzira na ishod → pozovi `record-login-attempt` da zabilježiš
//
// SIGURNOST:
//   - Funkcija je javna (verify_jwt = false) jer korisnik još NIJE prijavljen
//   - Koristi SERVICE_ROLE_KEY za pisanje u `login_attempts` tablicu
//     (zaobilazi RLS — to je jedini način pristupa)
//   - Ne otkriva postoji li račun s tim emailom (uvijek vraća isti odgovor)
//
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---- KONFIGURACIJA -----------------------------------------------------------
const WINDOW_MINUTES = 15;          // klizni prozor u kojem brojimo pokušaje
const MAX_PER_EMAIL_IP = 5;         // dopušteno neuspjelih po (email + IP)
const MAX_PER_IP = 20;              // dopušteno neuspjelih po samo IP
// -----------------------------------------------------------------------------

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email || email.length > 254) {
      return json({ allowed: true }, 200);
    }

    // Klijentska IP adresa — kod Lovable Cloud edge funkcija dolazi u headeru
    // `x-forwarded-for` (može sadržavati lanac IP-ova, uzimamo prvi).
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";

    const since = new Date(
      Date.now() - WINDOW_MINUTES * 60 * 1000,
    ).toISOString();

    // Brojimo neuspjele pokušaje za ovu kombinaciju u zadanom prozoru.
    const [{ count: emailIpFails }, { count: ipFails }] = await Promise.all([
      supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("email", email)
        .eq("ip_address", ip)
        .eq("success", false)
        .gte("created_at", since),
      supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ip)
        .eq("success", false)
        .gte("created_at", since),
    ]);

    const blocked =
      (emailIpFails ?? 0) >= MAX_PER_EMAIL_IP ||
      (ipFails ?? 0) >= MAX_PER_IP;

    if (blocked) {
      return json(
        {
          allowed: false,
          retry_after_minutes: WINDOW_MINUTES,
          // Namjerno ne otkrivamo precizan broj pokušaja niti razlog (email vs IP)
          // — to bi napadaču dalo informaciju o stanju zaštite.
          reason: "too_many_attempts",
        },
        429,
      );
    }

    return json({ allowed: true }, 200);
  } catch (err) {
    console.error("check-login-rate-limit error:", err);
    // Fail-open: ako rate-limiter padne, ne smijemo blokirati legitimne
    // korisnike. Sigurnost se oslanja na ostale slojeve (lozinka, 2FA).
    return json({ allowed: true }, 200);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
