import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, Eye, EyeOff, Trash2, Ban, ShieldOff, Flag, ExternalLink, Check, X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAdminAction } from "@/lib/adminLog";
import type { Database } from "@/integrations/supabase/types";

type Listing = Database["public"]["Tables"]["listings"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ReviewReport = Database["public"]["Tables"]["review_reports"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];

type ReportWithReview = ReviewReport & {
  review: Review | null;
};

export default function AdminModeration() {
  const { t } = useTranslation();
  const { user, role, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"listings" | "users" | "reports">("listings");

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold md:text-3xl">{t("admin.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.subtitle")}</p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="listings">{t("admin.tabListings")}</TabsTrigger>
            <TabsTrigger value="users">{t("admin.tabUsers")}</TabsTrigger>
            <TabsTrigger value="reports">{t("admin.tabReports")}</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4">
            <ListingsModeration adminId={user!.id} />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersModeration adminId={user!.id} />
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
            <ReportsModeration adminId={user!.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============ Listings ============
function ListingsModeration({ adminId }: { adminId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all" | "hidden" | "visible">("pending");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data || []) as Listing[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((l) =>
    filter === "all" ? true
      : filter === "hidden" ? l.hidden
      : filter === "pending" ? l.status === "under_review"
      : !l.hidden && l.status !== "under_review",
  );

  const approve = async (l: Listing) => {
    setActing(l.id);
    const { error } = await supabase
      .from("listings")
      .update({ status: "available", approved_at: new Date().toISOString(), approved_by: adminId })
      .eq("id", l.id);
    setActing(null);
    if (error) return toast.error(error.message);
    await logAdminAction({
      adminId, action: "approve_listing", targetType: "listing", targetId: l.id,
    });
    toast.success("Oglas odobren");
    load();
  };

  const reject = async (l: Listing, reason?: string) => {
    setActing(l.id);
    const { error } = await supabase
      .from("listings")
      .update({ status: "archived", hidden: true, hidden_reason: reason ?? "Odbijeno" })
      .eq("id", l.id);
    setActing(null);
    if (error) return toast.error(error.message);
    await logAdminAction({
      adminId, action: "reject_listing", targetType: "listing", targetId: l.id, reason,
    });
    toast.success("Oglas odbijen");
    load();
  };

  const toggleHide = async (l: Listing, reason?: string) => {
    setActing(l.id);
    const next = !l.hidden;
    const { error } = await supabase
      .from("listings")
      .update({ hidden: next, hidden_reason: next ? reason ?? null : null })
      .eq("id", l.id);
    setActing(null);
    if (error) return toast.error(error.message);
    await logAdminAction({
      adminId,
      action: next ? "hide_listing" : "unhide_listing",
      targetType: "listing",
      targetId: l.id,
      reason,
    });
    toast.success(next ? t("admin.listingHidden") : t("admin.listingUnhidden"));
    load();
  };

  const remove = async (l: Listing, reason?: string) => {
    setActing(l.id);
    const { error } = await supabase.from("listings").delete().eq("id", l.id);
    setActing(null);
    if (error) return toast.error(error.message);
    await logAdminAction({
      adminId, action: "delete_listing", targetType: "listing", targetId: l.id, reason,
    });
    toast.success(t("admin.listingDeleted"));
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "all", "visible", "hidden"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "pending" ? "Na pregledu" : t(`admin.filter_${f}`)}
            {f === "pending" && items.filter((x) => x.status === "under_review").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {items.filter((x) => x.status === "under_review").length}
              </Badge>
            )}
          </Button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("admin.noResults")}</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/listing/${l.id}`} className="font-semibold hover:underline">
                      {l.title}
                    </Link>
                    {l.hidden && <Badge variant="destructive">{t("admin.hidden")}</Badge>}
                    <Badge variant="outline">{l.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {l.city} · €{Number(l.price).toLocaleString("hr-HR")} · {l.size_m2} m² ·{" "}
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </p>
                  {l.hidden_reason && (
                    <p className="mt-1 text-xs text-destructive">{t("admin.hiddenReason")}: {l.hidden_reason}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {l.status === "under_review" && (
                    <>
                      <Button size="sm" disabled={acting === l.id} onClick={() => approve(l)}>
                        <Check className="h-4 w-4" /><span className="hidden sm:inline">Odobri</span>
                      </Button>
                      <ModerationConfirm
                        destructive
                        trigger={
                          <Button size="sm" variant="outline" disabled={acting === l.id}>
                            <X className="h-4 w-4" /><span className="hidden sm:inline">Odbij</span>
                          </Button>
                        }
                        title="Odbij oglas?"
                        needsReason
                        onConfirm={(reason) => reject(l, reason)}
                      />
                    </>
                  )}
                  <ModerationConfirm
                    trigger={
                      <Button size="sm" variant="outline" disabled={acting === l.id}>
                        {l.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <span className="hidden sm:inline">
                          {l.hidden ? t("admin.unhide") : t("admin.hide")}
                        </span>
                      </Button>
                    }
                    title={l.hidden ? t("admin.confirmUnhide") : t("admin.confirmHide")}
                    needsReason={!l.hidden}
                    onConfirm={(reason) => toggleHide(l, reason)}
                  />
                  <ModerationConfirm
                    destructive
                    trigger={
                      <Button size="sm" variant="destructive" disabled={acting === l.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    title={t("admin.confirmDeleteListing")}
                    description={t("admin.deleteIrreversible")}
                    needsReason
                    onConfirm={(reason) => remove(l, reason)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Users ============
function UsersModeration({ adminId }: { adminId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "banned" | "active">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data || []) as Profile[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) => {
    if (filter === "banned" && !p.banned) return false;
    if (filter === "active" && p.banned) return false;
    if (search && !(p.full_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleBan = async (p: Profile, reason?: string) => {
    const next = !p.banned;
    const { error } = await supabase
      .from("profiles")
      .update({ banned: next, banned_reason: next ? reason ?? null : null })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    await logAdminAction({
      adminId,
      action: next ? "ban_user" : "unban_user",
      targetType: "user",
      targetId: p.id,
      reason,
    });
    toast.success(next ? t("admin.userBanned") : t("admin.userUnbanned"));
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 flex-1 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
          placeholder={t("admin.searchByName")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "active", "banned"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {t(`admin.userFilter_${f}`)}
          </Button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("admin.noResults")}</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.full_name || t("admin.unnamed")}</span>
                    {p.banned && <Badge variant="destructive">{t("admin.banned")}</Badge>}
                    {p.is_verified && <Badge>{t("admin.verified")}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.phone || "—"} · {t("admin.joined")} {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </p>
                  {p.banned_reason && (
                    <p className="mt-1 text-xs text-destructive">{t("admin.banReason")}: {p.banned_reason}</p>
                  )}
                </div>
                <ModerationConfirm
                  destructive={!p.banned}
                  trigger={
                    <Button size="sm" variant={p.banned ? "outline" : "destructive"}>
                      {p.banned ? <ShieldOff className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      <span className="hidden sm:inline">
                        {p.banned ? t("admin.unban") : t("admin.ban")}
                      </span>
                    </Button>
                  }
                  title={p.banned ? t("admin.confirmUnban") : t("admin.confirmBan")}
                  needsReason={!p.banned}
                  onConfirm={(reason) => toggleBan(p, reason)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Reports ============
function ReportsModeration({ adminId }: { adminId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ReportWithReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "resolved" | "dismissed">("pending");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("review_reports")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    const reports = (data || []) as ReviewReport[];

    // Fetch the reviews referenced by these reports (FK is logical, not enforced)
    const ids = Array.from(new Set(reports.map((r) => r.review_id)));
    let reviewsById: Record<string, Review> = {};
    if (ids.length > 0) {
      const { data: revs } = await supabase.from("reviews").select("*").in("id", ids);
      (revs || []).forEach((r: Review) => { reviewsById[r.id] = r; });
    }
    setItems(reports.map((r) => ({ ...r, review: reviewsById[r.review_id] || null })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab]);

  const resolve = async (r: ReportWithReview, status: "resolved" | "dismissed", deleteReview: boolean) => {
    if (deleteReview && r.review) {
      const { error } = await supabase.from("reviews").delete().eq("id", r.review.id);
      if (error) return toast.error(error.message);
      await logAdminAction({
        adminId, action: "delete_review", targetType: "review", targetId: r.review.id,
        reason: `Resolved report ${r.id}`,
      });
    }
    const { error } = await supabase
      .from("review_reports")
      .update({ status, resolved_by: adminId, resolved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAdminAction({
      adminId, action: status === "resolved" ? "resolve_report" : "dismiss_report",
      targetType: "report", targetId: r.id,
    });
    toast.success(t("admin.reportUpdated"));
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">{t("admin.reportPending")}</TabsTrigger>
          <TabsTrigger value="resolved">{t("admin.reportResolved")}</TabsTrigger>
          <TabsTrigger value="dismissed">{t("admin.reportDismissed")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("admin.noResults")}</p>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Flag className="h-4 w-4 text-destructive" />
                    <span className="font-medium">{t("admin.reason")}:</span>
                    <span>{r.reason}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                  {r.review ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("admin.reportedReview")} · ★ {r.review.rating}
                      </div>
                      <p className="mt-1 text-sm">{r.review.comment || <em>{t("admin.noComment")}</em>}</p>
                      <Link
                        to={`/listing/${r.review.listing_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {t("admin.viewListing")} <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm italic text-muted-foreground">{t("admin.reviewDeleted")}</p>
                  )}
                </div>
                {tab === "pending" && (
                  <div className="flex flex-shrink-0 flex-col gap-2">
                    {r.review && (
                      <ModerationConfirm
                        destructive
                        trigger={
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">{t("admin.removeReview")}</span>
                          </Button>
                        }
                        title={t("admin.confirmRemoveReview")}
                        onConfirm={() => resolve(r, "resolved", true)}
                      />
                    )}
                    <Button size="sm" variant="outline" onClick={() => resolve(r, "dismissed", false)}>
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("admin.dismiss")}</span>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Confirm dialog (with optional reason field) ============
function ModerationConfirm({
  trigger, title, description, needsReason, destructive, onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  needsReason?: boolean;
  destructive?: boolean;
  onConfirm: (reason?: string) => unknown;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {needsReason && (
          <Textarea
            placeholder={t("admin.reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={async () => {
              await onConfirm(reason.trim() || undefined);
              setReason("");
              setOpen(false);
            }}
          >
            <Check className="h-4 w-4" />
            {t("common.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
