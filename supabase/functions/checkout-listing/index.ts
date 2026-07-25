// Checkout for a single listing: basic (4.99€), standard (9.99€), or promo (free).
// STUB MODE: marks payment as paid immediately so the flow works end-to-end.
// To switch to real Stripe later, see the commented section below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICES = {
  basic:    { cents: 499, days: 30, boost_days: 0 },
  standard: { cents: 999, days: 30, boost_days: 7 },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // KYC gate
    const { data: prof } = await supabase
      .from("profiles").select("is_verified").eq("id", user.id).maybeSingle();
    if (!prof?.is_verified) {
      return new Response(JSON.stringify({ error: "NOT_VERIFIED" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const listingId: string = body?.listing_id;
    const pkg: "basic" | "standard" | "promo" = body?.package;
    const promoCode: string | undefined = body?.promo_code?.toString().trim().toUpperCase();
    const autoRenew: boolean = !!body?.auto_renew;

    if (!listingId || !["basic","standard","promo"].includes(pkg)) {
      return new Response(JSON.stringify({ error: "INVALID_PARAMS" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify ownership
    const { data: listing } = await supabase
      .from("listings").select("id, landlord_id, status").eq("id", listingId).maybeSingle();
    if (!listing || listing.landlord_id !== user.id) {
      return new Response(JSON.stringify({ error: "NOT_OWNER" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let promoId: string | null = null;
    let amount = 0;
    let days = 30;
    let boostDays = 0;

    if (pkg === "promo") {
      if (!promoCode) {
        return new Response(JSON.stringify({ error: "PROMO_REQUIRED" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: promo } = await supabase
        .from("promo_codes").select("*").eq("code", promoCode).maybeSingle();
      if (!promo || !promo.active || promo.kind !== "listing_free"
        || (promo.expires_at && new Date(promo.expires_at) < new Date())
        || promo.times_used >= promo.max_uses) {
        return new Response(JSON.stringify({ error: "PROMO_INVALID" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: redemp } = await supabase
        .from("promo_redemptions").select("id")
        .eq("promo_code_id", promo.id).eq("user_id", user.id).maybeSingle();
      if (redemp) {
        return new Response(JSON.stringify({ error: "PROMO_ALREADY_USED" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      promoId = promo.id;
      // Record redemption + increment counter
      await supabase.from("promo_redemptions").insert({
        promo_code_id: promo.id, user_id: user.id, listing_id: listingId,
      });
      await supabase.from("promo_codes")
        .update({ times_used: promo.times_used + 1 }).eq("id", promo.id);
    } else {
      const def = PRICES[pkg];
      amount = def.cents;
      days = def.days;
      boostDays = def.boost_days;
    }

    // ============================================================
    // STUB MODE — mark payment paid + activate listing immediately.
    // ------------------------------------------------------------
    // TODO: Replace with real Stripe Checkout when API key is added:
    //
    // import Stripe from "https://esm.sh/stripe@14?target=denonext";
    // const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    // const session = await stripe.checkout.sessions.create({
    //   mode: "payment",
    //   line_items: [{
    //     price_data: {
    //       currency: "eur",
    //       product_data: { name: pkg === "standard" ? "Standard listing 30d + boost 7d" : "Basic listing 30d" },
    //       unit_amount: amount,
    //     },
    //     quantity: 1,
    //   }],
    //   success_url: `${origin}/landlord?paid=1`,
    //   cancel_url: `${origin}/landlord?cancelled=1`,
    //   metadata: { listing_id: listingId, user_id: user.id, package: pkg, auto_renew: String(autoRenew) },
    // });
    // (Activation then happens inside a Stripe webhook handler.)
    // ============================================================

    const now = new Date();
    const paidUntil = pkg === "promo"
      ? new Date(now.getTime() + 30 * 24 * 3600 * 1000)
      : new Date(now.getTime() + days * 24 * 3600 * 1000);
    const boostUntil = boostDays > 0
      ? new Date(now.getTime() + boostDays * 24 * 3600 * 1000) : null;

    await supabase.from("listing_payments").insert({
      user_id: user.id, listing_id: listingId, package: pkg,
      amount_cents: amount, currency: "EUR", promo_code_id: promoId,
      status: "paid", paid_at: now.toISOString(),
    });

    await supabase.from("listings").update({
      paid_until: paidUntil.toISOString(),
      boost_until: boostUntil?.toISOString() ?? null,
      auto_renew: autoRenew,
      payment_kind: pkg,
    }).eq("id", listingId);

    return new Response(JSON.stringify({
      stub: true, paid: true, paid_until: paidUntil.toISOString(),
      boost_until: boostUntil?.toISOString() ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
