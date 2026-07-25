import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Shield, Pencil, Check, X, Inbox as InboxIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { hr } from "date-fns/locale";

export default function PassportHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [passport, setPassport] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from("renter_passports" as any).select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("passport_access_requests" as any)
        .select("*, landlord:profiles!passport_access_requests_landlord_id_fkey(full_name, avatar_path), listing:listings(title, city)")
        .eq("passport_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setPassport(pRes.data);
    setRequests((rRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const respond = async (id: string, status: "approved" | "declined" | "revoked") => {
    const { error } = await supabase
      .from("passport_access_requests" as any)
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Pristup odobren" : status === "declined" ? "Pristup odbijen" : "Pristup opozvan");
    load();
  };

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

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Putovnica najmoprimca · Roofy" description="Upravljaj svojom putovnicom i pristupom." />
      <Navbar />
      <main className="container max-w-3xl py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Putovnica najmoprimca</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Verificirani profil najmoprimca. Podaci ostaju privatni dok ne odobriš pristup najmodavcu.
            </p>
          </div>
          <Button onClick={() => navigate("/passport/edit")}>
            <Pencil className="h-4 w-4" /> {passport ? "Uredi" : "Kreiraj"}
          </Button>
        </div>

        {!passport ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Još nemaš putovnicu. Kreiraj ju i najmodavci će brže odgovarati na tvoje upite.
          </Card>
        ) : (
          <Card className="p-6 grid gap-3 text-sm">
            <Row label="Zanimanje" value={passport.occupation} />
            <Row label="Poslodavac" value={passport.employer} />
            <Row label="Radni status" value={passport.employment_status} />
            <Row label="Mjesečni prihod" value={passport.monthly_income_eur ? `${passport.monthly_income_eur} €` : null} />
            <Row label="Broj članova" value={passport.household_size?.toString()} />
            <Row label="Ljubimci" value={passport.has_pets ? (passport.pet_description || "Da") : "Ne"} />
            <Row label="Pušač" value={passport.smoker ? "Da" : "Ne"} />
            <Row label="Datum useljenja" value={passport.move_in_date} />
            <Row label="Trajanje najma" value={passport.desired_duration_months ? `${passport.desired_duration_months} mj` : null} />
            <Row label="Jezici" value={(passport.languages ?? []).join(", ") || null} />
            {passport.bio && (
              <div>
                <div className="text-xs uppercase text-muted-foreground">O meni</div>
                <p className="mt-1 whitespace-pre-wrap">{passport.bio}</p>
              </div>
            )}
          </Card>
        )}

        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <InboxIcon className="h-4 w-4" /> Zahtjevi za pristup
          </h2>
          <div className="mt-3 space-y-2">
            {pending.length === 0 && history.length === 0 && (
              <p className="text-sm text-muted-foreground">Još nema zahtjeva.</p>
            )}
            {pending.map((r) => (
              <Card key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.landlord?.full_name || "Najmodavac"}</p>
                  {r.listing && (
                    <p className="text-xs text-muted-foreground">
                      Oglas: <Link to={`/listing/${r.listing_id}`} className="underline">{r.listing.title}</Link>
                    </p>
                  )}
                  {r.message && <p className="mt-1 text-sm text-muted-foreground">"{r.message}"</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: hr })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => respond(r.id, "declined")}>
                    <X className="h-4 w-4" /> Odbij
                  </Button>
                  <Button size="sm" onClick={() => respond(r.id, "approved")}>
                    <Check className="h-4 w-4" /> Odobri
                  </Button>
                </div>
              </Card>
            ))}
            {history.map((r) => (
              <Card key={r.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{r.landlord?.full_name || "Najmodavac"}</span>
                  {r.listing && <span className="text-muted-foreground"> · {r.listing.title}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                    {r.status === "approved" ? "Odobren" : r.status === "declined" ? "Odbijen" : "Opozvan"}
                  </Badge>
                  {r.status === "approved" && (
                    <Button size="sm" variant="ghost" onClick={() => respond(r.id, "revoked")}>
                      Opozovi
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
