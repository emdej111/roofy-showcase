import { useEffect, useState } from "react";
import { CalendarClock, Check, X, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Row = {
  id: string;
  listing_id: string;
  tenant_id: string;
  proposed_at: string;
  status: string;
  tenant_note: string | null;
  landlord_note: string | null;
  created_at: string;
  listings: { title: string } | null;
};

export function LandlordViewingsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("viewings")
      .select("id, listing_id, tenant_id, proposed_at, status, tenant_note, landlord_note, created_at, listings(title)")
      .eq("landlord_id", user.id)
      .order("proposed_at", { ascending: true });
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const act = async (id: string, status: "approved" | "declined") => {
    setBusyId(id);
    const { error } = await supabase.from("viewings")
      .update({ status, landlord_note: notes[id]?.trim() || null })
      .eq("id", id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Termin potvrđen" : "Zahtjev odbijen");
    load();
  };

  const pending = rows.filter((r) => r.status === "pending");
  const upcoming = rows.filter((r) => r.status === "approved" && new Date(r.proposed_at) > new Date());

  if (loading) {
    return <div className="mt-6 flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (pending.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Zahtjevi za razgledavanje</h2>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{r.listings?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.proposed_at).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {r.tenant_note && <p className="mt-1 text-sm">„{r.tenant_note}"</p>}
                </div>
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                placeholder="Poruka (opcionalno) — npr. predloži drugi termin"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => act(r.id, "approved")} disabled={busyId === r.id}>
                  <Check className="h-4 w-4" />Potvrdi
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, "declined")} disabled={busyId === r.id}>
                  <X className="h-4 w-4" />Odbij
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Users className="h-4 w-4" />Potvrđeni termini
          </div>
          <ul className="space-y-1 text-sm">
            {upcoming.map((r) => (
              <li key={r.id} className="flex justify-between rounded border border-border/50 bg-background px-3 py-2">
                <span>{r.listings?.title}</span>
                <span className="text-muted-foreground">
                  {new Date(r.proposed_at).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
