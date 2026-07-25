import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ListingWithPhotos } from "@/types/listing";

export default function Favorites() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("favorites")
        .select("listing:listings(*, listing_photos(id,url,display_order))")
        .eq("tenant_id", user.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (data ?? []).map((d: any) => d.listing).filter(Boolean) as ListingWithPhotos[];
      setListings(list);

      const ids = Array.from(new Set(list.map((l) => l.landlord_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, is_verified")
          .in("id", ids);
        const map: Record<string, boolean> = {};
        (profs || []).forEach((p: { id: string; is_verified: boolean }) => {
          map[p.id] = p.is_verified;
        });
        setVerifiedMap(map);
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container py-8">
        <h1 className="text-2xl font-bold md:text-3xl">{t("dashboard.tenantTitle")}</h1>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : listings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">{t("dashboard.noFavorites")}</p>
            <Button asChild className="mt-4"><Link to="/search">{t("dashboard.noFavoritesCta")}</Link></Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => <ListingCard key={l.id} listing={l} landlordVerified={verifiedMap[l.landlord_id]} />)}
          </div>
        )}
      </div>
    </div>
  );
}
