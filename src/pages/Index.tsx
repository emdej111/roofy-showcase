import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Map, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";

import zagrebImg from "@/assets/cities/zagreb.jpg";
import splitImg from "@/assets/cities/split.jpg";
import rijekaImg from "@/assets/cities/rijeka.jpg";
import osijekImg from "@/assets/cities/osijek.jpg";
import zadarImg from "@/assets/cities/zadar.jpg";
import dubrovnikImg from "@/assets/cities/dubrovnik.jpg";

import heroZagreb from "@/assets/hero/zagreb2.webp.asset.json";
import heroZagreb3 from "@/assets/hero/zagreb3.webp.asset.json";
import heroVarazdin from "@/assets/hero/varazdin.webp.asset.json";
import heroSplit from "@/assets/hero/split.webp.asset.json";
import heroSplit1 from "@/assets/hero/split1.webp.asset.json";
import heroSplit2 from "@/assets/hero/split2.webp.asset.json";
import heroRijeka from "@/assets/hero/rijeka.webp.asset.json";
import heroPula1 from "@/assets/hero/pula1.webp.asset.json";
import heroPula2 from "@/assets/hero/pula2.webp.asset.json";
import heroPula3 from "@/assets/hero/pula3.webp.asset.json";

const cities = [
  { name: "Zagreb", slug: "zagreb", img: zagrebImg },
  { name: "Split", slug: "split", img: splitImg },
  { name: "Rijeka", slug: "rijeka", img: rijekaImg },
  { name: "Osijek", slug: "osijek", img: osijekImg },
  { name: "Zadar", slug: "zadar", img: zadarImg },
  { name: "Dubrovnik", slug: "dubrovnik", img: dubrovnikImg },
];

const HERO_IMAGES = [
  heroZagreb.url,
  heroSplit.url,
  heroPula1.url,
  heroRijeka.url,
  heroZagreb3.url,
  heroSplit2.url,
  heroPula2.url,
  heroVarazdin.url,
  heroSplit1.url,
  heroPula3.url,
];

const ROTATE_MS = 6000;

const Index = () => {
  const { t } = useTranslation();
  const { user, role, isVerified, loading } = useAuth();
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    const needsVerification = role !== "admin" && !isVerified;
    if (needsVerification) return <Navigate to="/verify" replace />;
    if (role === "landlord") return <Navigate to="/landlord" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/search" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Roofy — Najam stana u Hrvatskoj na karti"
        description="Pretražite stanove za dugoročni i srednjoročni najam u Hrvatskoj. Karta, jasan status, direktan kontakt s iznajmljivačem."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Roofy",
          url: typeof window !== "undefined" ? window.location.origin : "",
          potentialAction: {
            "@type": "SearchAction",
            target: `${typeof window !== "undefined" ? window.location.origin : ""}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <Navbar />

      {/* HERO — premium glass + ken burns */}
      <section className="relative isolate overflow-hidden bg-background">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background)) 78%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background)) 78%, transparent 100%)",
          }}
        >
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 h-full w-full object-cover animate-ken-burns transition-opacity ease-in-out will-change-transform"
              style={{ opacity: i === heroIndex ? 1 : 0, transitionDuration: "1500ms" }}
            />
          ))}
          {/* Strong left scrim — guarantees text legibility on any photo */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10 md:from-black/80 md:via-black/40 md:to-transparent" />
          {/* Soft radial bloom behind copy for extra contrast */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 70% at 22% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
            }}
          />
          {/* Bottom fade into page background */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="container relative pt-20 pb-32 md:pt-28 md:pb-44 lg:pt-32 lg:pb-52">
          <div className="max-w-xl animate-fade-in">
            <span
              className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-semibold uppercase text-white ring-1 ring-white/25 backdrop-blur-sm"
              style={{ letterSpacing: "0.18em", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
            >
              {t("landing.heroBadge", "Najam stanova u Hrvatskoj")}
            </span>
            <h1
              className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl"
              style={{ fontWeight: 800, lineHeight: 1.1, textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}
            >
              {t("landing.heroTitle")}
            </h1>
            <p
              className="mt-5 max-w-lg text-base font-medium text-white/95 md:text-lg"
              style={{ lineHeight: 1.55, textShadow: "0 1px 10px rgba(0,0,0,0.55)" }}
            >
              {t("landing.heroSubtitle")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth/register?role=tenant"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-elevated ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-12px_hsl(var(--primary)/0.6)] md:text-base"
              >
                {t("landing.tenantCta")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/auth/register?role=landlord"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-7 py-3.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 md:text-base"
              >
                {t("landing.landlordCta")}
              </Link>
            </div>

            <div className="mt-8 flex gap-1.5" aria-hidden>
              {HERO_IMAGES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === heroIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>



      <section className="container pt-4 pb-16 md:pb-24">

        {/* FEATURES — soft cards */}
        <div className="mt-16 grid gap-5 md:mt-20 md:grid-cols-3">
          {[
            {
              icon: Map,
              tone: "bg-accent/10 text-accent",
              title: t("landing.feature1TitleShort"),
              desc: t("landing.feature1DescShort"),
            },
            {
              icon: ShieldCheck,
              tone: "bg-primary/10 text-primary",
              title: t("landing.feature2TitleShort"),
              desc: t("landing.feature2DescShort"),
            },
            {
              icon: SlidersHorizontal,
              tone: "bg-muted text-foreground",
              title: t("landing.feature3TitleShort"),
              desc: t("landing.feature3DescShort"),
            },
          ].map((f, i) => (
            <article
              key={i}
              className="rounded-2xl bg-card p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.tone}`}>
                <f.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CITIES */}
      <section className="container pb-20 md:pb-28">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {t("landing.browseByCity")}
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cities.map((c) => (
            <div
              key={c.slug}
              className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-soft"
              aria-label={c.name}
            >
              <img
                src={c.img}
                alt={c.name}
                width={800}
                height={1024}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="text-base font-bold text-background drop-shadow-md md:text-lg">
                  {c.name}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("landing.citiesHint")}
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-border/60 bg-secondary/40 py-20 md:py-24">
        <div className="container">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            {t("landing.howItWorks")}
          </h2>
          <div className="mx-auto mt-12 grid max-w-5xl gap-10 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-base font-bold text-background">
                  {n}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{t(`landing.step${n}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.step${n}Desc`)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              to="/auth/register"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-elevated transition-all hover:scale-[1.02] hover:bg-foreground/90 md:text-base"
            >
              {t("common.register")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Roofy — {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
};

export default Index;
