// Croatian-friendly slug helpers for SEO URLs
// Format: /najam/:city/:slug-:shortid

const DIACRITICS: Record<string, string> = {
  č: "c", ć: "c", đ: "d", š: "s", ž: "z",
  Č: "C", Ć: "C", Đ: "D", Š: "S", Ž: "Z",
};

export function slugify(input: string): string {
  if (!input) return "";
  const replaced = input
    .split("")
    .map((ch) => DIACRITICS[ch] ?? ch)
    .join("");
  return replaced
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function listingPath(listing: {
  id: string;
  title: string;
  city: string;
}): string {
  const city = slugify(listing.city) || "hrvatska";
  const titleSlug = slugify(listing.title) || "stan";
  const shortId = listing.id.slice(0, 8);
  return `/najam/${city}/${titleSlug}-${shortId}`;
}

// Extract the short id (first 8 chars of uuid) from a slug like "lijepi-stan-12345678"
export function shortIdFromSlug(slug: string): string | null {
  const m = slug.match(/-([a-f0-9]{8})$/i);
  return m ? m[1] : null;
}
