import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Shield, Lock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PassportView() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [passport, setPassport] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user || !userId) return;
    setLoading(true);
    const [pRes, prRes, rRes] = await Promise.all([
      supabase.from("renter_passports" as any).select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("full_name, avatar_path").eq("id", userId).maybeSingle(),
      supabase
        .from("passport_access_requests" as any)
        .select("*")
        .eq("passport_user_id", userId)
        .eq("landlord_id", user.id)
        .is("listing_id", null)
        .maybeSingle(),
    ]);
    setPassport(pRes.data);
    setProfile(prRes.data);
    setRequest(rRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, userId]);

  const submitRequest = async () => {
    if (!user || !userId) return;
    setSubmitting(true);
    const { error } = await supabase.from("passport_access_requests" as any).upsert(
      { passport_user_id: userId, landlord_id: user.id, message: message.trim() || null, status: "pending", listing_id: null },
      { onConflict: "passport_user_id,landlord_id,listing_id" }
    );
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Zahtjev poslan.");
    setMessage("");
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

  const approved = request?.status === "approved";
  const hasData = passport && approved;

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`Putovnica · ${profile?.full_name ?? "Korisnik"}`} description="" />
      <Navbar />
      <main className="container max-w-2xl py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Putovnica: {profile?.full_name ?? "Korisnik"}
          </h1>
        </div>

        {!passport && (
          <Card className="p-6 text-sm text-muted-foreground">
            Ovaj korisnik još nije kreirao svoju putovnicu najmoprimca.
          </Card>
        )}

        {passport && !approved && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4" />
              <span className="font-medium">Podaci su privatni.</span>
              {request?.status === "pending" && <Badge variant="secondary">Zahtjev na čekanju</Badge>}
              {request?.status === "declined" && <Badge variant="destructive">Zahtjev odbijen</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Zatraži pristup putovnici. Korisnik će dobiti obavijest i može ju odobriti ili odbiti.
            </p>
            <Textarea
              placeholder="Kratka poruka (npr. za koji oglas si zainteresiran)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-end">
              <Button onClick={submitRequest} disabled={submitting || request?.status === "pending"}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {request?.status === "pending" ? "Zahtjev poslan" : "Zatraži pristup"}
              </Button>
            </div>
          </Card>
        )}

        {hasData && (
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
