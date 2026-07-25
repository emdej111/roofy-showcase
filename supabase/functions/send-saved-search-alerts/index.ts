// Saved-search email alerts dispatcher
// Runs on demand (or via a future cron). For each saved search with notify_email = true,
// finds new matching listings created since last_notified_at and emails the tenant.
//
// ⚠️ EMAIL SENDING IS STUBBED OUT FOR TESTING.
// To actually send emails, plug in an email provider below where indicated.
// Recommended options:
//   1. Lovable Emails (built-in) — call the `send-transactional-email` edge function
//   2. Resend — POST to https://api.resend.com/emails with RESEND_API_KEY
//
// See the TODO block in `sendAlertEmail()` at the bottom of this file.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SavedFilters {
  city?: string;
  priceRange?: [number, number];
  sizeRange?: [number, number];
  rooms?: string;
  furnished?: string;
  petsOnly?: boolean;
  parkingOnly?: boolean;
}

interface Listing {
  id: string;
  title: string;
  city: string;
  price: number;
  size_m2: number;
  rooms: number;
  furnished: string | null;
  pets: string | null;
  parking: string | null;
  status: string;
  created_at: string;
}

function matches(l: Listing, f: SavedFilters): boolean {
  if (l.status !== "available") return false;
  if (f.city && f.city !== "any" && l.city !== f.city) return false;
  if (f.priceRange && (l.price < f.priceRange[0] || l.price > f.priceRange[1])) return false;
  if (f.sizeRange && (l.size_m2 < f.sizeRange[0] || l.size_m2 > f.sizeRange[1])) return false;
  if (f.rooms && f.rooms !== "any") {
    if (f.rooms === "4+") { if (l.rooms < 4) return false; }
    else if (Number(l.rooms) !== Number(f.rooms)) return false;
  }
  if (f.furnished && f.furnished !== "any" && l.furnished !== f.furnished) return false;
  if (f.petsOnly && !(l.pets === "yes" || l.pets === "negotiable")) return false;
  if (f.parkingOnly && (!l.parking || l.parking === "none")) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pull all active saved searches
  const { data: searches, error: sErr } = await supabase
    .from("saved_searches")
    .select("id, tenant_id, name, filters, last_notified_at")
    .eq("notify_email", true);

  if (sErr) {
    return new Response(JSON.stringify({ error: sErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let emailsSent = 0;

  for (const s of searches ?? []) {
    // New listings since last notification
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title, city, price, size_m2, rooms, furnished, pets, parking, status, created_at")
      .gt("created_at", s.last_notified_at);

    const matching = (listings ?? []).filter((l) =>
      matches(l as Listing, (s.filters ?? {}) as SavedFilters),
    );

    if (matching.length > 0) {
      // Look up tenant email from auth.users
      const { data: userRes } = await supabase.auth.admin.getUserById(s.tenant_id);
      const email = userRes?.user?.email;

      if (email) {
        await sendAlertEmail(email, s.name, matching as Listing[]);
        emailsSent++;
      }
    }

    // Bump cursor regardless so we don't re-check the same window
    await supabase
      .from("saved_searches")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", s.id);

    processed++;
  }

  return new Response(JSON.stringify({ processed, emailsSent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// =====================================================================
// 🔧 TODO: Plug in real email provider here.
//
// Right now this is a STUB that just logs to the function logs.
// To enable real sending, replace the body below. Examples:
//
//   // --- Option A: Lovable Emails ---
//   await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
//     },
//     body: JSON.stringify({ to: email, subject, html }),
//   });
//
//   // --- Option B: Resend ---
//   await fetch("https://api.resend.com/emails", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
//     },
//     body: JSON.stringify({
//       from: "Roofy <alerts@yourdomain.com>",
//       to: [email],
//       subject,
//       html,
//     }),
//   });
// =====================================================================
async function sendAlertEmail(email: string, searchName: string, listings: Listing[]) {
  const subject = `${listings.length} new match${listings.length === 1 ? "" : "es"} for "${searchName}"`;
  const html = `
    <h2>New listings for "${searchName}"</h2>
    <ul>
      ${listings.map((l) => `<li><strong>${l.title}</strong> — ${l.city}, €${l.price}/mo, ${l.size_m2}m²</li>`).join("")}
    </ul>
  `;

  // STUB: log only. Wire up the provider above to actually deliver.
  console.log("[send-saved-search-alerts] (stub) would email", email, "→", subject);
  console.log(html);
}
