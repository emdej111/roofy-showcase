import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "product";
  locale?: "hr_HR" | "en_US";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

export function SEO({
  title,
  description,
  canonical,
  image,
  type = "website",
  locale = "hr_HR",
  jsonLd,
  noindex,
}: SEOProps) {
  const fullTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
  const desc = description
    ? description.length > 160
      ? description.slice(0, 157) + "..."
      : description
    : undefined;
  const url =
    canonical ??
    (typeof window !== "undefined" ? window.location.href.split("?")[0] : undefined);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {desc && <meta name="description" content={desc} />}
      {url && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {desc && <meta property="og:description" content={desc} />}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={locale} />
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {desc && <meta name="twitter:description" content={desc} />}
      {image && <meta name="twitter:image" content={image} />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
