import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, Calendar, Home as HomeIcon, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListingCard } from "@/components/ListingCard";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { StarRating } from "@/components/StarRating";
import { SEO } from "@/components/SEO";
import { ResponseTimeBadge } from "@/components/ResponseTimeBadge";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import type { ListingWithPhotos, Profile } from "@/types/listing";

type Review = {
  id: string;
  tenant_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function LandlordProfile() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewerNames, setReviewerNames] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!prof) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(prof as Profile);

      const [listingsRes, reviewsRes] = await Promise.all([
        supabase
          .from("listings")
          .select("*, listing_photos(id,url,display_order)")
          .eq("landlord_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select("id, tenant_id, rating, comment, created_at")
          .eq("landlord_id", id)
          .eq("direction", "tenant_to_landlord")
          .order("created_at", { ascending: false }),
      ]);

      setListings((listingsRes.data || []) as ListingWithPhotos[]);
      const revs = (reviewsRes.data || []) as Review[];
      setReviews(revs);

      if (revs.length > 0) {
        const ids = Array.from(new Set(revs.map((r) => r.tenant_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        const map: Record<string, string | null> = {};
        (profs || []).forEach((p: { id: string; full_name: string | null }) => {
          map[p.id] = p.full_name;
        });
        setReviewerNames(map);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">{t("landlordProfile.notFound")}</p>
          <Button asChild className="mt-4">
            <Link to="/search">
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const activeListings = listings.filter((l) => l.status === "available");
  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const cities = Array.from(new Set(listings.map((l) => l.city))).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${profile.full_name || "Landlord"} · Roofy`}
        description={`${activeListings.length} active listings${reviews.length > 0 ? ` · ${avg.toFixed(1)}★ from ${reviews.length} reviews` : ""}`}
      />
      <Navbar />
      <main className="container max-w-5xl py-8">
        {/* Hero card */}
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-2xl font-bold text-primary-foreground">
                  {(profile.full_name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {profile.full_name || t("landlordProfile.unnamed")}
                  </h1>
                  {profile.is_verified && <VerifiedBadge size="md" />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("landlordProfile.memberSince", {
                      date: format(new Date(profile.created_at), "MMMM yyyy"),
                    })}
                  </span>
                  {cities.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {cities.join(", ")}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <ResponseTimeBadge landlordId={profile.id} />
                </div>
              </div>
            </div>

            <div className="flex gap-6 md:gap-8">
              <div>
                <p className="text-2xl font-bold">{activeListings.length}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("landlordProfile.activeListings")}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-2xl font-bold">
                    {reviews.length > 0 ? avg.toFixed(1) : "—"}
                  </p>
                  {reviews.length > 0 && <StarRating value={avg} readOnly size="sm" />}
                </div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {reviews.length} {t("reviews.count")}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Listings */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("landlordProfile.listings")}</h2>
          {activeListings.length === 0 ? (
            <Card className="mt-3 p-12 text-center text-sm text-muted-foreground">
              <HomeIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              {t("landlordProfile.noListings")}
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeListings.map((l) => (
                <ListingCard key={l.id} listing={l} landlordVerified={profile.is_verified} />
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("reviews.title")}</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("reviews.empty")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {reviewerNames[r.tenant_id] || t("reviews.anonymous")}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="mt-1">
                    <StarRating value={r.rating} readOnly size="sm" />
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
