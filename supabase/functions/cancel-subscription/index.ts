// =====================================================================
// Cancel / reactivate subscription (STUB — real Stripe later)
//
// POST { action: "cancel" | "reactivate" }
//   cancel     → cancel_at_period_end=true (pretplata ostaje aktivna
//                do current_period_end, pa se downgrade-a na free)
//   reactivate → cancel_at_period_end=false (nastavlja se naplaćivati)
//
// Kada se spoji pravi Stripe:
//   stripe.subscriptions.update(sub.stripe_subscription_id, {
//     cancel_at_period_end: action === "cancel",
//   });
// Webhook `customer.subscription.updated` će ažurirati lokalni red.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = (await req.json()) as { action?: "cancel" | "reactivate" };
    const action = body.action ?? "cancel";
    if (action !== "cancel" && action !== "reactivate") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch existing subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("tier, current_period_end")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (!sub || sub.tier === "free") {
      return new Response(JSON.stringify({ error: "No active paid subscription" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: action === "cancel" })
      .eq("user_id", userRes.user.id);

    return new Response(
      JSON.stringify({
        ok: true,
        action,
        active_until: sub.current_period_end,
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
