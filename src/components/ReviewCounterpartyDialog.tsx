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
import { Loader2, Star, Trash2 } from "lucide-react";

type Direction = "tenant_to_landlord" | "landlord_to_tenant";

interface Props {
  inquiryId: string;
  tenantId: string;
  landlordId: string;
  listingId: string;
}

export function ReviewCounterpartyDialog({ inquiryId, tenantId, landlordId, listingId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  const isLandlord = user.id === landlordId;
  const isTenant = user.id === tenantId;
  if (!isLandlord && !isTenant) return null;
  const direction: Direction = isLandlord ? "landlord_to_tenant" : "tenant_to_landlord";

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment")
        .eq("inquiry_id", inquiryId)
        .eq("direction", direction)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setRating(data.rating);
        setComment(data.comment || "");
      } else {
        setExistingId(null);
        setRating(5);
        setComment("");
      }
    })();
  }, [open, inquiryId, direction]);

  const submit = async () => {
    setSubmitting(true);
    const trimmed = comment.trim().slice(0, 1000);
    let error;
    if (existingId) {
      ({ error } = await supabase
        .from("reviews")
        .update({ rating, comment: trimmed || null })
        .eq("id", existingId));
    } else {
      ({ error } = await supabase.from("reviews").insert({
        inquiry_id: inquiryId,
        tenant_id: tenantId,
        landlord_id: landlordId,
        listing_id: listingId,
        rating,
        comment: trimmed || null,
        direction,
      }));
    }
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(t(existingId ? "reviews.updated" : "reviews.submitted"));
    setOpen(false);
  };

  const remove = async () => {
    if (!existingId) return;
    const { error } = await supabase.from("reviews").delete().eq("id", existingId);
    if (error) return toast.error(error.message);
    toast.success(t("reviews.deleted"));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Star className="h-4 w-4" />
          {isLandlord ? t("reviews.reviewTenant") : t("reviews.write")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isLandlord ? t("reviews.reviewTenant") : t("reviews.write")}
          </DialogTitle>
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
            <p className="mt-1 text-xs text-muted-foreground text-right">{comment.length}/1000</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {existingId ? (
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
  );
}
