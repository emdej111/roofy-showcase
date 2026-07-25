// =====================================================================
// 🔧 STUB CHECKOUT — replace with real Stripe later
//
// Maps a `planKey` (sent from Pricing.tsx) to a (tier, addon_featured,
// addon_analytics) tuple and immediately upgrades the subscription row.
// This lets us test the upgrade UX end-to-end without real money.
//
// Plan map (matches Pricing.tsx):
//   pro              → tier=pro,    no addons              (12,99 €)
//   agency_basic     → tier=agency, no addons              (62,99 €)
//   agency_featured  → tier=agency, addon_featured=true    (68,98 €)
//   agency_analytics → tier=agency, addon_analytics=true   (68,98 €)
//   agency_pro       → tier=agency, both addons=true       (72,98 €)
//
// To wire up REAL Stripe (next step):
//   1. Add STRIPE_SECRET_KEY via Lovable secrets.
//   2. Create one Stripe Product + recurring Price per planKey,
//      store IDs in PRICE_MAP below.
//   3. Replace the stub block with:
//        import Stripe from "https://esm.sh/stripe@14.0.0?target=denonext";
//        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
//        const session = await stripe.checkout.sessions.create({
//          mode: "subscription",
//          customer_email: user.email,
//          line_items: [{ price: PRICE_MAP[planKey], quantity: 1 }],
//          locale: locale === "hr" ? "hr" : "en",
//          success_url: `${origin}/landlord?upgraded=${planKey}`,
//          cancel_url: `${origin}/pricing`,
//          metadata: { user_id: user.id, planKey },
//        });
//        return { url: session.url };
//   4. Add `stripe-webhook` function for checkout.session.completed +
//      customer.subscription.updated/deleted to write back to subscriptions.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlanKey =
  | "pro"
  | "agency_basic"
  | "agency_featured"
  | "agency_analytics"
  | "agency_pro";

type Tier = "free" | "pro" | "agency";

interface PlanMapping {
  tier: Tier;
  addon_featured: boolean;
  addon_analytics: boolean;
}

const PLAN_MAP: Record<PlanKey, PlanMapping> = {
  pro:              { tier: "pro",    addon_featured: false, addon_analytics: false },
  agency_basic:     { tier: "agency", addon_featured: false, addon_analytics: false },
  agency_featured:  { tier: "agency", addon_featured: true,  addon_analytics: false },
  agency_analytics: { tier: "agency", addon_featured: false, addon_analytics: true  },
  agency_pro:       { tier: "agency", addon_featured: true,  addon_analytics: true  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userRes, error: uErr } = await supabase.auth.getUser();
    if (uErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept both legacy { tier } and new { planKey } payloads
    const body = (await req.json()) as { planKey?: PlanKey; tier?: PlanKey; locale?: string };
    const planKey = (body.planKey ?? body.tier) as PlanKey | undefined;

    if (!planKey || !(planKey in PLAN_MAP)) {
      return new Response(JSON.stringify({ error: "Invalid planKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapping = PLAN_MAP[planKey];

    // Service-role client to write subscription
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await admin.from("subscriptions").upsert(
      {
        user_id: userRes.user.id,
        tier: mapping.tier,
        addon_featured: mapping.addon_featured,
        addon_analytics: mapping.addon_analytics,
        status: "active",
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" },
    );

    // STUB: pretend we got a Stripe checkout URL — return success url directly
    const origin = req.headers.get("origin") ?? "";
    return new Response(
      JSON.stringify({
        url: `${origin}/landlord?upgraded=${planKey}`,
        stub: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
