import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomCode(prefix: string, len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

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
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const batchLabel = String(body?.batch_label ?? "BATCH").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "BATCH";
    const kind = body?.kind === "agency_month" ? "agency_month" : "listing_free";
    const count = Math.min(Math.max(parseInt(body?.count) || 1, 1), 500);
    const expiresAt = body?.expires_at || null;

    const rows: any[] = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        code: randomCode(batchLabel),
        batch_label: batchLabel, kind, max_uses: 1, expires_at: expiresAt,
        active: true, created_by: user.id,
      });
    }

    const { data, error } = await supabase
      .from("promo_codes").insert(rows).select("code");
    if (error) throw error;

    return new Response(JSON.stringify({ codes: data?.map((r: any) => r.code) ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
