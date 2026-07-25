import { useEffect, useState, MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  listingId: string;
  variant?: "overlay" | "inline";
  className?: string;
}

export function FavoriteButton({ listingId, variant = "overlay", className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setIsFav(false); return; }
    let cancelled = false;
    supabase
      .from("favorites")
      .select("id")
      .eq("tenant_id", user.id)
      .eq("listing_id", listingId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsFav(!!data); });
    return () => { cancelled = true; };
  }, [user, listingId]);

  const toggle = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/auth/login"); return; }
    if (busy) return;
    setBusy(true);
    if (isFav) {
      const { error } = await supabase.from("favorites").delete()
        .eq("tenant_id", user.id).eq("listing_id", listingId);
      if (error) toast.error(error.message);
      else { setIsFav(false); toast.success("Uklonjeno iz omiljenih"); }
    } else {
      const { error } = await supabase.from("favorites")
        .insert({ tenant_id: user.id, listing_id: listingId });
      if (error) toast.error(error.message);
      else { setIsFav(true); toast.success("Spremljeno u omiljene"); }
    }
    setBusy(false);
  };

  const base = variant === "overlay"
    ? "absolute right-3 top-14 z-[2] h-9 w-9 rounded-full bg-background/95 shadow-soft backdrop-blur transition hover:scale-110"
    : "h-9 w-9 rounded-full border border-border bg-background transition hover:bg-accent";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFav ? "Ukloni iz omiljenih" : "Spremi u omiljene"}
      aria-pressed={isFav}
      className={cn(base, "inline-flex items-center justify-center", className)}
    >
      <Heart
        className={cn("h-4 w-4 transition", isFav ? "fill-red-500 text-red-500" : "text-foreground/70")}
      />
    </button>
  );
}
