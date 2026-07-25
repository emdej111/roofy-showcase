// Public sitemap.xml — lists all available listings with canonical SEO URLs
// Deployed at: <project>.functions.supabase.co/sitemap
// We expose it at /sitemap.xml via a SPA-side rewrite or by giving Google the function URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://najamhr.app";

const DIACRITICS: Record<string, string> = {
  č: "c", ć: "c", đ: "d", š: "s", ž: "z",
  Č: "C", Ć: "C", Đ: "D", Š: "S", Ž: "Z",
};

function slugify(input: string): string {
  if (!input) return "";
  const replaced = input.split("").map((ch) => DIACRITICS[ch] ?? ch).join("");
  return replaced
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function listingPath(l: { id: string; title: string; city: string }) {
  const city = slugify(l.city) || "hrvatska";
  const titleSlug = slugify(l.title) || "stan";
  return `/najam/${city}/${titleSlug}-${l.id.slice(0, 8)}`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  }[c]!));
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: listings } = await supabase
      .from("listings")
      .select("id,title,city,updated_at,status")
      .eq("status", "available")
      .order("updated_at", { ascending: false })
      .limit(5000);

    const staticUrls = ["/", "/search"];
    const now = new Date().toISOString();

    const urls: string[] = [];
    for (const path of staticUrls) {
      urls.push(
        `<url><loc>${SITE_URL}${path}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>${path === "/" ? "1.0" : "0.8"}</priority></url>`,
      );
    }
    for (const l of listings ?? []) {
      const loc = `${SITE_URL}${listingPath(l)}`;
      const lastmod = (l.updated_at ?? now).toString();
      urls.push(
        `<url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
      );
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.join("\n") +
      `\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err) {
    return new Response(`error: ${(err as Error).message}`, { status: 500 });
  }
});
