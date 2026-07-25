// Toggle addon flags on the user's subscription.
// Body: { featured: boolean, analytics: boolean }
// Allowed only if user is on Pro or Agency tier.

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json()) as { featured?: boolean; analytics?: boolean };
    const featured = !!body.featured;
    const analytics = !!body.analytics;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub } = await admin
      .from("subscriptions")
      .select("tier")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (!sub || (sub.tier !== "pro" && sub.tier !== "agency")) {
      return new Response(
        JSON.stringify({ error: "Add-ons require Pro or Agency plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await admin
      .from("subscriptions")
      .update({ addon_featured: featured, addon_analytics: analytics })
      .eq("user_id", userRes.user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, featured, analytics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
