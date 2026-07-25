// Redeem an agency_month promo code: gives 30 days of free agency-tier subscription.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: prof } = await supabase
      .from("profiles").select("is_verified, landlord_type").eq("id", user.id).maybeSingle();
    if (!prof?.is_verified) return new Response(JSON.stringify({ error: "NOT_VERIFIED" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (prof?.landlord_type !== "agency") return new Response(JSON.stringify({ error: "AGENCY_ONLY" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim().toUpperCase();
    if (!code) return new Response(JSON.stringify({ error: "CODE_REQUIRED" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: promo } = await supabase.from("promo_codes").select("*").eq("code", code).maybeSingle();
    if (!promo || !promo.active || promo.kind !== "agency_month"
      || (promo.expires_at && new Date(promo.expires_at) < new Date())
      || promo.times_used >= promo.max_uses) {
      return new Response(JSON.stringify({ error: "PROMO_INVALID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: existing } = await supabase
      .from("promo_redemptions").select("id")
      .eq("promo_code_id", promo.id).eq("user_id", user.id).maybeSingle();
    if (existing) return new Response(JSON.stringify({ error: "ALREADY_USED" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const { data: sub } = await supabase
      .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (sub) {
      await supabase.from("subscriptions").update({
        tier: "agency", status: "active", cancel_at_period_end: true,
        current_period_end: periodEnd,
      }).eq("user_id", user.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: user.id, tier: "agency", status: "active",
        cancel_at_period_end: true, current_period_end: periodEnd,
      });
    }

    await supabase.from("promo_redemptions").insert({
      promo_code_id: promo.id, user_id: user.id,
    });
    await supabase.from("promo_codes")
      .update({ times_used: promo.times_used + 1 }).eq("id", promo.id);

    return new Response(JSON.stringify({ ok: true, period_end: periodEnd }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
