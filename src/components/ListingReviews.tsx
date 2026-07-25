import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquareQuote, Trash2, Pencil } from "lucide-react";
import { ReportReviewButton } from "@/components/ReportReviewButton";

type Review = {
  id: string;
  inquiry_id: string;
  tenant_id: string;
  landlord_id: string;
  listing_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

interface Props {
  landlordId: string;
  listingId: string;
}

export function ListingReviews({ landlordId, listingId }: Props) {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [eligibleInquiryId, setEligibleInquiryId] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("landlord_id", landlordId)
      .eq("direction", "tenant_to_landlord")
      .order("created_at", { ascending: false });
    const list = (data || []) as Review[];
    setReviews(list);

    if (list.length > 0) {
      const ids = Array.from(new Set(list.map((r) => r.tenant_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const map: Record<string, { full_name: string | null }> = {};
      (profs || []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = { full_name: p.full_name };
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  // Check if logged-in tenant is eligible to review (has an inquiry on this listing)
  useEffect(() => {
    const check = async () => {
      if (!user || role !== "tenant" || user.id === landlordId) {
        setEligibleInquiryId(null);
        setMyReview(null);
        return;
      }
      const { data: inq } = await supabase
        .from("inquiries")
        .select("id")
        .eq("tenant_id", user.id)
        .eq("landlord_id", landlordId)
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!inq) {
        setEligibleInquiryId(null);
        setMyReview(null);
        return;
      }
      setEligibleInquiryId(inq.id);
      const { data: existing } = await supabase
        .from("reviews")
        .select("*")
        .eq("inquiry_id", inq.id)
        .eq("tenant_id", user.id)
        .eq("direction", "tenant_to_landlord")
        .maybeSingle();
      if (existing) {
        setMyReview(existing as Review);
        setRating(existing.rating);
        setComment(existing.comment || "");
      } else {
        setMyReview(null);
      }
    };
    check();
  }, [user, role, landlordId, listingId, reviews.length]);

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  const submit = async () => {
    if (!user || !eligibleInquiryId) return;
    if (rating < 1 || rating > 5) {
      toast.error(t("reviews.invalidRating"));
      return;
    }
    setSubmitting(true);
    const trimmed = comment.trim().slice(0, 1000);
    if (myReview) {
      const { error } = await supabase
        .from("reviews")
        .update({ rating, comment: trimmed || null })
        .eq("id", myReview.id);
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success(t("reviews.updated"));
    } else {
      const { error } = await supabase.from("reviews").insert({
        inquiry_id: eligibleInquiryId,
        tenant_id: user.id,
        landlord_id: landlordId,
        listing_id: listingId,
        rating,
        comment: trimmed || null,
        direction: "tenant_to_landlord",
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success(t("reviews.submitted"));
    }
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!myReview) return;
    const { error } = await supabase.from("reviews").delete().eq("id", myReview.id);
    if (error) return toast.error(error.message);
    toast.success(t("reviews.deleted"));
    setMyReview(null);
    setRating(5);
    setComment("");
    load();
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{t("reviews.title")}</h2>
          <div className="mt-1 flex items-center gap-2">
            <StarRating value={avg} readOnly size="md" />
            <span className="text-sm font-medium">
              {reviews.length > 0 ? avg.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              ({reviews.length} {t("reviews.count")})
            </span>
          </div>
        </div>

        {eligibleInquiryId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant={myReview ? "outline" : "default"}>
                {myReview ? <Pencil className="h-4 w-4" /> : <MessageSquareQuote className="h-4 w-4" />}
                {myReview ? t("reviews.edit") : t("reviews.write")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{myReview ? t("reviews.edit") : t("reviews.write")}</DialogTitle>
                <DialogDescription>{t("reviews.dialogDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">{t("reviews.yourRating")}</p>
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">{t("reviews.yourComment")}</p>
                  <Textarea
                    rows={4}
                    value={comment}
                    maxLength={1000}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("reviews.commentPlaceholder")}
                  />
                  <p className="mt-1 text-xs text-muted-foreground text-right">
                    {comment.length}/1000
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                {myReview ? (
                  <Button variant="ghost" onClick={remove} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {t("common.delete")}
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={submit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("common.submit")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reviews.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {profiles[r.tenant_id]?.full_name || t("reviews.anonymous")}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StarRating value={r.rating} readOnly size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                {user && r.tenant_id !== user.id && <ReportReviewButton reviewId={r.id} />}
              </div>
              {r.comment && (
                <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">{r.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
