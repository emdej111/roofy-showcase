import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Eye, Loader2, MailQuestion, Heart, BarChart3, Sparkles, ArrowUpRight, CreditCard, RotateCcw } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import type { ListingWithPhotos } from "@/types/listing";
import type { Database } from "@/integrations/supabase/types";
import { AddonPanel } from "@/components/landlord/AddonPanel";
import { ListingCheckoutDialog } from "@/components/landlord/ListingCheckoutDialog";
import { LandlordViewingsPanel } from "@/components/landlord/LandlordViewingsPanel";

type Status = Database["public"]["Enums"]["listing_status"];

export default function LandlordDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscription, limit } = useSubscription();
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [inquiryCount, setInquiryCount] = useState(0);
  const [favByListing, setFavByListing] = useState<Record<string, number>>({});
  const [inqByListing, setInqByListing] = useState<Record<string, number>>({});
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const isAgency = subscription?.tier === "agency";

  // After creating a new listing, auto-open checkout (skipped for agency).
  useEffect(() => {
    const newId = searchParams.get("new");
    if (newId && !isAgency) {
      setCheckoutFor(newId);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgency]);

  const fetchAll = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("listings")
      .select("*, listing_photos(id,url,display_order)")
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as ListingWithPhotos[];
    setListings(list);

    const ids = list.map((l) => l.id);
    if (ids.length) {
      const [favsRes, inqRes] = await Promise.all([
        supabase.from("favorites").select("listing_id").in("listing_id", ids),
        supabase.from("inquiries").select("listing_id").in("listing_id", ids),
      ]);
      const favMap: Record<string, number> = {};
      (favsRes.data ?? []).forEach((f) => { favMap[f.listing_id] = (favMap[f.listing_id] ?? 0) + 1; });
      const inqMap: Record<string, number> = {};
      (inqRes.data ?? []).forEach((i) => { inqMap[i.listing_id] = (inqMap[i.listing_id] ?? 0) + 1; });
      setFavByListing(favMap);
      setInqByListing(inqMap);
      setInquiryCount((inqRes.data ?? []).length);
    } else {
      setInquiryCount(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setListings((prev) => prev.filter((l) => l.id !== id));
    toast.success(t("listing.deleteSuccess"));
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{t("dashboard.landlordTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <MailQuestion className="mr-1 inline h-4 w-4" />
              {inquiryCount} {t("dashboard.inquiriesReceived").toLowerCase()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild size="lg">
              <Link to="/landlord/analytics"><BarChart3 className="h-4 w-4" />{t("dashboard.analytics")}</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/landlord/new"><Plus className="h-4 w-4" />{t("dashboard.newListing")}</Link>
            </Button>
          </div>
        </div>

        {/* Plan / quota banner */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {t("dashboard.planLabel")}: {subscription?.tier === "agency" ? t("pricing.agency") : t("pricing.payg")}
              </p>
              <p className="text-xs text-muted-foreground">
                {subscription?.tier === "agency"
                  ? `${listings.length} / ∞ ${t("dashboard.listingsUsed")}`
                  : t("dashboard.paygHint")}
              </p>
            </div>
          </div>
          {subscription?.tier !== "agency" && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/pricing">
                {t("dashboard.upgradePlan")}<ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        <AddonPanel />
        <LandlordViewingsPanel />

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">{t("dashboard.noListings")}</p>
            <Button asChild className="mt-4">
              <Link to="/landlord/new">{t("dashboard.noListingsCta")}</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {listings.map((l) => {
              const photo = l.listing_photos?.[0]?.url;
              const symbol = l.currency === "EUR" ? "€" : "kn";
              return (
                <div key={l.id} className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-soft sm:flex-row">
                  <div className="h-32 w-full flex-shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48">
                    {photo && <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{l.title}</h3>
                        <p className="text-sm text-muted-foreground">{l.city} · {l.address}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{symbol}{Number(l.price).toLocaleString("hr-HR")}{t("listing.perMonth")}</span>
                      <span>{Number(l.size_m2)} m²</span>
                      <span>{t("listing.rooms", { count: Number(l.rooms) })}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{l.view_count}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{favByListing[l.id] ?? 0}</span>
                      <span className="inline-flex items-center gap-1"><MailQuestion className="h-3.5 w-3.5" />{inqByListing[l.id] ?? 0}</span>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      <Select value={l.status} onValueChange={(v) => handleStatus(l.id, v as Status)}>
                        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">{t("listing.statusAvailable")}</SelectItem>
                          <SelectItem value="reserved">{t("listing.statusReserved")}</SelectItem>
                          <SelectItem value="rented">{t("listing.statusRented")}</SelectItem>
                          <SelectItem value="archived">{t("listing.statusArchived")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {(l.status === "rented" || l.status === "reserved") && (
                        <Button variant="outline" size="sm" onClick={() => handleStatus(l.id, "available")}>
                          <RotateCcw className="h-4 w-4" />Vrati u dostupno
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/listing/${l.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/landlord/edit/${l.id}`}><Pencil className="h-4 w-4" />{t("common.edit")}</Link>
                      </Button>
                      {!isAgency && (l.status === "under_review" || l.status === "expired" || !(l as any).paid_until) && (
                        <Button size="sm" onClick={() => setCheckoutFor(l.id)}>
                          <CreditCard className="h-4 w-4" />Aktiviraj
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("listing.deleteListing")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("listing.deleteConfirm")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(l.id)}>{t("common.delete")}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ListingCheckoutDialog
        listingId={checkoutFor}
        open={!!checkoutFor}
        onOpenChange={(v) => !v && setCheckoutFor(null)}
        onSuccess={fetchAll}
      />
    </div>
  );
}
