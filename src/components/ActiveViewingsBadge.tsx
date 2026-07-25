import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ActiveViewingsBadge({ listingId }: { listingId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("viewings")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("status", "approved")
      .gte("proposed_at", new Date().toISOString())
      .then(({ count: c }) => { if (!cancelled) setCount(c ?? 0); });
    return () => { cancelled = true; };
  }, [listingId]);

  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Users className="h-3.5 w-3.5" />
      {count === 1 ? "1 osoba dolazi na razgledavanje" : `${count} osobe/a dolaze na razgledavanje`}
    </span>
  );
}
