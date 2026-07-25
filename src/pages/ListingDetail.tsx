import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MapPin, Maximize2, Heart, Loader2, Phone, Mail, Lock, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { PinPickerMap } from "@/components/map/PinPickerMap";
import { SEO } from "@/components/SEO";
import { ListingReviews } from "@/components/ListingReviews";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AvailabilityTimeline } from "@/components/AvailabilityTimeline";
import { ResponseTimeBadge } from "@/components/ResponseTimeBadge";
import { InquiryForm } from "@/components/InquiryForm";
import { ViewingRequestDialog } from "@/components/ViewingRequestDialog";
import { ActiveViewingsBadge } from "@/components/ActiveViewingsBadge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { ListingWithPhotos, Profile } from "@/types/listing";
import { listingPath, shortIdFromSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";

export default function ListingDetail() {
  const params = useParams();
  const { t, i18n } = useTranslation();
  const { user, role, verificationStatus } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ListingWithPhotos | null>(null);
  const [landlord, setLandlord] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isOwnerEarly = !!user && !!listing && user.id === listing.landlord_id;
  const isAdmin = role === "admin";
  const gated = !isAdmin && !isOwnerEarly && (!user || verificationStatus !== "approved");

  // Resolve listing id from either /listing/:id or /najam/:city/:slug
  const directId = params.id;
  const slugShortId = params.slug ? shortIdFromSlug(params.slug) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("listings")
        .select("*, listing_photos(id,url,display_order)")
        .limit(1);

      if (directId) {
        query = query.eq("id", directId);
      } else if (slugShortId) {
        // Match listing whose uuid starts with the 8-char short id (uuid range)
        const lo = `${slugShortId}-0000-0000-0000-000000000000`;
        const hi = `${slugShortId}-ffff-ffff-ffff-ffffffffffff`;
        query = query.gte("id", lo).lte("id", hi);
      } else {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: rows } = await query;
      const data = rows?.[0];
      if (cancelled) return;
      if (data) {
        setListing(data as ListingWithPhotos);
        // record view (trigger increments listings.view_count)
        let sessionId = localStorage.getItem("nh_session");
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem("nh_session", sessionId);
        }
        supabase
          .from("listing_views")
          .insert({ listing_id: data.id, viewer_id: user?.id ?? null, session_id: sessionId })
          .then();
        // landlord profile
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.landlord_id).maybeSingle();
        if (!cancelled) setLandlord(prof);
      }
      if (user && data) {
        const { data: fav } = await supabase.from("favorites").select("id").eq("listing_id", data.id).eq("tenant_id", user.id).maybeSingle();
        if (!cancelled) setIsFavorite(!!fav);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directId, slugShortId, user?.id]);

  const toggleFavorite = async () => {
    if (!user) { navigate("/auth/login"); return; }
    if (!listing) return;
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("tenant_id", user.id).eq("listing_id", listing.id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorites").insert({ tenant_id: user.id, listing_id: listing.id });
      setIsFavorite(true);
    }
  };

  const sendInquiry = async (payload: import("@/components/InquiryForm").InquiryPayload) => {
    if (!user || !listing) { navigate("/auth/login"); return; }
    setSending(true);
    const { data: existing } = await supabase
      .from("inquiries")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("tenant_id", user.id)
      .maybeSingle();
    let inquiryId = existing?.id;
    if (!inquiryId) {
      const { data: created, error } = await supabase
        .from("inquiries")
        .insert({
          listing_id: listing.id,
          tenant_id: user.id,
          landlord_id: listing.landlord_id,
          message: payload.message,
          move_in_date: payload.move_in_date,
          budget_max: payload.budget_max,
          household_size: payload.household_size,
          rental_period_months: payload.rental_period_months,
          pets: payload.pets,
          employment_status: payload.employment_status,
        })
        .select("id")
        .single();
      if (error) { setSending(false); toast.error(error.message); return; }
      inquiryId = created.id;
    } else if (payload.message) {
      const { error } = await supabase
        .from("messages")
        .insert({ inquiry_id: inquiryId, sender_id: user.id, body: payload.message });
      if (error) { setSending(false); toast.error(error.message); return; }
    }
    setSending(false);
    toast.success(t("search.inquirySent"));
    navigate(`/inbox?id=${inquiryId}`);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">Not found</div>
      </div>
    );
  }

  const photos = [...(listing.listing_photos ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const symbol = listing.currency === "EUR" ? "€" : "kn";
  const isOwner = user?.id === listing.landlord_id;
  const canonicalPath = listingPath(listing);

  // Redirect legacy /listing/:id to canonical SEO URL
  if (directId && typeof window !== "undefined" && window.location.pathname !== canonicalPath) {
    return <Navigate to={canonicalPath} replace />;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const canonical = `${origin}${canonicalPath}`;
  const heroPhoto = photos[0]?.url;
  const priceNum = Number(listing.price);
  const seoTitle = `${listing.title} — ${listing.city} | ${symbol}${priceNum.toLocaleString("hr-HR")}/mj | Roofy`;
  const seoDesc =
    (listing.description?.slice(0, 140) ||
      `${Number(listing.size_m2)} m², ${Number(listing.rooms)} sobe, ${listing.address}, ${listing.city}.`) +
    ` Najam ${symbol}${priceNum.toLocaleString("hr-HR")} mjesečno.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Apartment",
    name: listing.title,
    description: listing.description ?? seoDesc,
    url: canonical,
    image: photos.map((p) => p.url),
    floorSize: { "@type": "QuantitativeValue", value: Number(listing.size_m2), unitCode: "MTK" },
    numberOfRooms: Number(listing.rooms),
    address: {
      "@type": "PostalAddress",
      streetAddress: listing.address,
      addressLocality: listing.city,
      addressCountry: "HR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: listing.latitude,
      longitude: listing.longitude,
    },
    offers: {
      "@type": "Offer",
      price: priceNum,
      priceCurrency: listing.currency,
      availability:
        listing.status === "available"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: priceNum,
        priceCurrency: listing.currency,
        unitCode: "MON",
      },
    },
  };

  const features: { label: string; value: string | null }[] = [
    { label: t("listing.heating"), value: listing.heating ? t(`listing.heating${capitalize(listing.heating)}`) : null },
    { label: t("listing.furnished"), value: listing.furnished ? t(`listing.furnished${capitalize(listing.furnished)}`) : null },
    { label: t("listing.parking"), value: listing.parking ? t(`listing.parking${capitalize(listing.parking)}`) : null },
    { label: t("listing.pets"), value: listing.pets ? t(`listing.pets${capitalize(listing.pets)}`) : null },
    { label: t("listing.condition"), value: listing.condition ? t(`listing.condition${capitalize(listing.condition).replace(/_(.)/g, (_, c) => c.toUpperCase())}`) : null },
    { label: t("listing.floor"), value: listing.floor != null ? `${listing.floor}${listing.total_floors ? `/${listing.total_floors}` : ""}` : null },
    { label: t("listing.minRental"), value: listing.min_rental_months ? `${listing.min_rental_months} ${t("listing.months")}` : null },
    { label: t("listing.availableFrom"), value: listing.available_from ?? null },
  ].filter((f) => f.value);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={canonical}
        image={heroPhoto}
        type="product"
        locale={i18n.language === "en" ? "en_US" : "hr_HR"}
        jsonLd={jsonLd}
      />
      <Navbar />
      <div className="container py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Button>

        {/* Photo gallery — visible to everyone */}
        <div className="relative grid gap-2 md:grid-cols-3">
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => photos.length && setLightboxOpen(true)}
              className="block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted"
            >
              {photos[activePhoto] && (
                <img
                  src={photos[activePhoto].url}
                  alt={listing.title}
                  className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
                />
              )}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-2">
            {photos.slice(0, 4).map((p, i) => {
              const isLastTile = i === 3 && photos.length > 4;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePhoto(i);
                    if (isLastTile) setLightboxOpen(true);
                  }}
                  className={cn(
                    "relative aspect-[4/3] overflow-hidden rounded-lg",
                    i === activePhoto && !isLastTile && "ring-2 ring-primary",
                  )}
                >
                  <img
                    src={p.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {isLastTile && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm font-medium">
                      +{photos.length - 4} {t("listing.morePhotos")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>


        {/* Lightbox */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-5xl border-0 bg-background/95 p-0 sm:p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>{listing.title}</DialogTitle>
              <DialogDescription>
                {t("listing.photo")} {activePhoto + 1} / {photos.length}
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              {photos[activePhoto] && (
                <img
                  src={photos[activePhoto].url}
                  alt={listing.title}
                  className="max-h-[85vh] w-full object-contain"
                />
              )}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhoto((i) => (i - 1 + photos.length) % photos.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background"
                    aria-label="Previous"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhoto((i) => (i + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background rotate-180"
                    aria-label="Next"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs">
                    {activePhoto + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={listing.status} />
                  <ActiveViewingsBadge listingId={listing.id} />
                </div>
                <h1 className="mt-2 text-2xl font-bold md:text-3xl">{listing.title}</h1>
                <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {gated
                    ? `${maskStreetNumber(listing.address)}, ${listing.city}`
                    : `${listing.address}, ${listing.city}`}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {symbol}{Number(listing.price).toLocaleString("hr-HR")}
                  <span className="text-sm font-normal text-muted-foreground">{t("listing.perMonth")}</span>
                </div>
              </div>

            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-border py-4 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Maximize2 className="h-4 w-4" />{Number(listing.size_m2)} m²
              </span>
              <span>·</span>
              <span>{t("listing.rooms", { count: Number(listing.rooms) })}</span>
            </div>

            <div className="mt-6">
              <AvailabilityTimeline
                status={listing.status}
                availableFrom={listing.available_from}
                minRentalMonths={listing.min_rental_months}
              />
            </div>

            {listing.description && (
              <div className="mt-6">
                <h2 className="mb-2 text-lg font-semibold">{t("listing.description")}</h2>
                <p className="whitespace-pre-line text-muted-foreground">{listing.description}</p>
              </div>
            )}

            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">{t("listing.notes")}</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {features.map((f) => (
                  <div key={f.label} className="flex justify-between border-b border-border/60 py-1.5">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-medium">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">{t("listing.utilities")}</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  ["utilities_electricity", t("listing.electricity")],
                  ["utilities_water", t("listing.water")],
                  ["utilities_gas", t("listing.gas")],
                  ["utilities_internet", t("listing.internet")],
                  ["elevator", t("listing.elevator")],
                  ["balcony", t("listing.balcony")],
                  ["storage_room", t("listing.storageRoom")],
                  ["air_conditioning", t("listing.airConditioning")],
                  ["appliance_washer", t("listing.washer")],
                  ["appliance_dishwasher", t("listing.dishwasher")],
                  ["appliance_fridge", t("listing.fridge")],
                  ["appliance_oven", t("listing.oven")],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ].filter(([k]) => (listing as any)[k]).map(([k, label]) => (
                  <span key={k as string} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                    {label as string}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">{t("listing.pinLocation")}</h2>
              <PinPickerMap
                value={{ lat: listing.latitude, lng: listing.longitude }}
                onChange={() => {}}
                height="320px"
              />
            </div>


            <ListingReviews landlordId={listing.landlord_id} listingId={listing.id} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 md:sticky md:top-20 md:self-start">
            <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("auth.fullName")}</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <Link
                  to={`/landlord/${listing.landlord_id}/profile`}
                  className="font-semibold hover:text-primary transition-colors"
                >
                  {(() => {
                    const name = landlord?.full_name?.trim();
                    if (!name) return "—";
                    if (user) return name;
                    const parts = name.split(/\s+/);
                    return parts.length < 2 ? parts[0] : `${parts[0]} ${parts[1][0]}.`;
                  })()}
                </Link>

                {landlord?.is_verified && <VerifiedBadge size="sm" />}
              </div>
              {landlord?.phone && !gated && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />{landlord.phone}
                </p>
              )}

              <div className="mt-3">
                <ResponseTimeBadge landlordId={listing.landlord_id} />
              </div>

              {!isOwner && gated && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {user ? "Verifikacija za kontakt" : "Prijavite se za kontakt"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kontakt najmodavca, slanje upita i zahtjev za razgledavanje dostupni su verificiranim korisnicima.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {user ? (
                      <Button onClick={() => navigate("/verify")} className="w-full">
                        <ShieldCheck className="h-4 w-4" /> Verificiraj profil
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => navigate("/auth/register")} className="w-full">
                          Registracija
                        </Button>
                        <Button onClick={() => navigate("/auth/login")} variant="outline" className="w-full">
                          Prijava
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!isOwner && !gated && (
                <>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="mt-4 w-full" size="lg">
                        <Mail className="h-4 w-4" />
                        {t("search.contactLandlord")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{t("search.sendInquiry")}</DialogTitle>
                        <DialogDescription>{listing.title}</DialogDescription>
                      </DialogHeader>
                      <InquiryForm
                        onSubmit={sendInquiry}
                        submitting={sending}
                        defaultBudget={Math.round(Number(listing.price))}
                        defaultPeriod={listing.min_rental_months ?? 12}
                      />
                    </DialogContent>
                  </Dialog>

                  {role === "tenant" && listing.status === "available" && (
                    <ViewingRequestDialog
                      listingId={listing.id}
                      landlordId={listing.landlord_id}
                      listingTitle={listing.title}
                    />
                  )}

                  {role === "tenant" && (
                    <Button
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={toggleFavorite}
                    >
                      <Heart className={cn("h-4 w-4", isFavorite && "fill-accent text-accent")} />
                      {isFavorite ? t("search.removeFromFavorites") : t("search.saveToFavorites")}
                    </Button>
                  )}
                </>
              )}

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Hide house number for non-verified visitors — reveal street name only.
function maskStreetNumber(address: string): string {
  if (!address) return "";
  return address.replace(/\s*\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?\s*$/, "").trim() || address;
}

