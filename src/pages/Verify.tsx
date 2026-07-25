import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldCheck, Upload, AlertCircle, CheckCircle2, XCircle, Clock, IdCard } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface VerificationRequestRow {
  id: string;
  full_name: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  rejection_reason: string | null;
  id_document_path: string;
  id_back_document_path: string | null;
  proof_document_path: string | null;
  agency_name: string | null;
  oib: string | null;
  created_at: string;
}

export default function Verify() {
  const { user, role, isVerified, verificationStatus, refreshVerification, loading: authLoading } = useAuth();
  const [request, setRequest] = useState<VerificationRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [landlordType, setLandlordType] = useState<"private" | "agency" | null>(null);

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [oib, setOib] = useState("");
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);

  const isLandlord = role === "landlord";
  const isAgency = isLandlord && landlordType === "agency";

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("landlord_type, agency_name, oib, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      setLandlordType((profile.landlord_type as "private" | "agency" | null) ?? null);
      if (profile.agency_name) setAgencyName(profile.agency_name);
      if (profile.oib) setOib(profile.oib);
      if (profile.full_name) setFullName(profile.full_name);
    }

    const { data } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setRequest(data as any);
      setFullName(data.full_name);
      if ((data as any).agency_name) setAgencyName((data as any).agency_name);
      if ((data as any).oib) setOib((data as any).oib);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (isVerified) return <Navigate to="/" replace />;

  const canSubmit = !request || request.status === "rejected";

  const uploadFile = async (file: File, suffix: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${suffix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("verification-docs")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (fullName.trim().length < 2) {
      toast.error("Unesite svoje puno ime i prezime.");
      return;
    }
    if (isAgency && agencyName.trim().length < 2) {
      toast.error("Unesite naziv agencije.");
      return;
    }
    if (isLandlord && !/^\d{11}$/.test(oib.trim())) {
      toast.error("OIB mora imati točno 11 znamenki.");
      return;
    }
    if (!request && (!idFront || !idBack)) {
      toast.error("Učitajte sliku prednje i zadnje strane dokumenta.");
      return;
    }
    setSubmitting(true);
    try {
      let idPath = request?.id_document_path || "";
      let idBackPath = request?.id_back_document_path || "";

      if (idFront) idPath = await uploadFile(idFront, "id-front");
      if (idBack) idBackPath = await uploadFile(idBack, "id-back");

      const baseFields: Record<string, unknown> = {
        full_name: fullName.trim(),
        id_document_path: idPath,
        id_back_document_path: idBackPath,
      };
      if (isLandlord) baseFields.oib = oib.trim();
      if (isAgency) baseFields.agency_name = agencyName.trim();

      if (request) {
        const { error } = await supabase
          .from("verification_requests")
          .update({
            ...baseFields,
            status: "pending",
            admin_notes: null,
            rejection_reason: null,
          } as any)
          .eq("id", request.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("verification_requests").insert({
          landlord_id: user.id,
          ...baseFields,
        } as any);
        if (error) throw error;
      }

      // Mirror OIB / agency name onto the profile too
      if (isLandlord) {
        await supabase
          .from("profiles")
          .update({
            oib: oib.trim(),
            ...(isAgency ? { agency_name: agencyName.trim() } : {}),
          } as any)
          .eq("id", user.id);
      }

      toast.success("Dokumenti zaprimljeni. Čeka se provjera.");
      setIdFront(null);
      setIdBack(null);
      await load();
      await refreshVerification();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-xl py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Verifikacija identiteta</h1>
            <p className="text-sm text-muted-foreground">
              Verifikacija je obavezna za korištenje Roofy aplikacije.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {request && (
              <Card className="mb-6 p-4">
                <div className="flex items-start gap-3">
                  {request.status === "approved" && <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />}
                  {request.status === "pending" && <Clock className="mt-0.5 h-5 w-5 text-accent" />}
                  {request.status === "rejected" && <XCircle className="mt-0.5 h-5 w-5 text-destructive" />}
                  <div className="flex-1">
                    {request.status === "pending" && (
                      <p className="font-medium">
                        Vaši dokumenti su zaprimljeni i bit će provjereni u najkraćem roku.
                      </p>
                    )}
                    {request.status === "rejected" && (
                      <>
                        <p className="font-medium">Verifikacija odbijena</p>
                        {(request.rejection_reason || request.admin_notes) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium">Razlog:</span>{" "}
                            {request.rejection_reason || request.admin_notes}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-muted-foreground">
                          Molimo ponovite proces s ispravnim dokumentima.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {verificationStatus === "pending" && request && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Pristup karti, oglasima i porukama bit će omogućen čim administrator odobri vaše dokumente.
                </AlertDescription>
              </Alert>
            )}

            {canSubmit && (
              <Card className="space-y-4 p-6">
                {isAgency && (
                  <div>
                    <Label htmlFor="agency_name">Naziv agencije</Label>
                    <Input
                      id="agency_name"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      maxLength={200}
                      placeholder="npr. Vaša agencija d.o.o."
                      className="mt-1.5"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="full_name">
                    {isAgency
                      ? "Ime i prezime odgovorne osobe (kao na dokumentu)"
                      : "Ime i prezime (kao na dokumentu)"}
                  </Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={200}
                    className="mt-1.5"
                  />
                </div>

                {isLandlord && (
                  <div>
                    <Label htmlFor="oib">OIB</Label>
                    <Input
                      id="oib"
                      inputMode="numeric"
                      maxLength={11}
                      value={oib}
                      onChange={(e) => setOib(e.target.value.replace(/\D/g, ""))}
                      placeholder="11 znamenki"
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAgency ? "OIB agencije (pravne osobe)." : "Vaš osobni OIB."}
                    </p>
                  </div>
                )}


                <div>
                  <Label htmlFor="id_front" className="flex items-center gap-2">
                    <IdCard className="h-4 w-4" /> Prednja strana dokumenta
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Osobna iskaznica, putovnica ili vozačka dozvola.
                  </p>
                  <Input
                    id="id_front"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdFront(e.target.files?.[0] ?? null)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="id_back" className="flex items-center gap-2">
                    <IdCard className="h-4 w-4" /> Stražnja strana dokumenta
                  </Label>
                  <Input
                    id="id_back"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdBack(e.target.files?.[0] ?? null)}
                    className="mt-1.5"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Vaši dokumenti se prenose putem zaštićene SSL/TLS veze i pohranjuju s AES-256 enkripcijom.
                  Pristup im imaju isključivo administratori putem privremenih potpisanih linkova,
                  a nakon uspješne verifikacije se trajno brišu.
                </p>

                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {request ? "Pošalji ponovno" : "Pošalji na provjeru"}
                </Button>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
