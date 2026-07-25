// =============================================================================
// record-login-attempt  (Roofy Security)
// =============================================================================
//
// SVRHA:
// Bilježi SVAKI pokušaj prijave (uspješan ili ne) u tablicu `login_attempts`.
// Klijent je dužan zvati ovu funkciju nakon `signInWithPassword` — bez obzira
// na ishod.
//
// ZAŠTO ZASEBNA FUNKCIJA (umjesto da klijent direktno piše u tablicu):
// `login_attempts` ima RLS koji zabranjuje INSERT iz anon/authenticated klijenta.
// Da je dopušteno, napadač bi mogao "trovati" tablicu lažnim uspjehom i tako
// resetirati brojač. Ovako samo SERVICE_ROLE (server-side) može pisati.
//
// PRIVATNOST:
// - Bilježimo email u plaintextu jer ga trebamo za usporedbu — ali tablicu
//   automatski čistimo nakon 7 dana (vidi `purge_old_login_attempts`).
// - User-agent je opcionalan, koristan za forenziku ako se nešto desi.
//
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const success = Boolean(body.success);

    if (!email || email.length > 254) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";

    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { error } = await supabase.from("login_attempts").insert({
      email,
      ip_address: ip,
      success,
      user_agent: userAgent,
    });

    if (error) {
      console.error("record-login-attempt insert error:", error);
      return json({ ok: false }, 500);
    }

    // Best-effort cleanup — povremeno (~5% pokušaja) pokrećemo brisanje starih
    // zapisa. Bez pg_cron-a (koji nije dostupan korisnicima) ovo je
    // najjednostavniji način da tablica ne raste neograničeno.
    if (Math.random() < 0.05) {
      await supabase.rpc("purge_old_login_attempts").catch(() => {
        /* ignore — cleanup je best-effort */
      });
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("record-login-attempt error:", err);
    return json({ ok: false }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
