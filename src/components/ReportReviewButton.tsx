import { useState } from "react";
import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  reviewId: string;
}

export function ReportReviewButton({ reviewId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) {
      toast.error(t("review.loginToReport"));
      return;
    }
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      toast.error(t("review.reportTooShort"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("review_reports")
      .insert({ review_id: reviewId, reporter_id: user.id, reason: trimmed });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.error(t("review.alreadyReported"));
      else toast.error(error.message);
      return;
    }
    toast.success(t("review.reported"));
    setReason("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          aria-label={t("review.report")}
        >
          <Flag className="h-3.5 w-3.5" />
          {t("review.report")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("review.reportTitle")}</DialogTitle>
          <DialogDescription>{t("review.reportDescription")}</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder={t("review.reportPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={submitting} variant="destructive">
            {t("review.submitReport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
