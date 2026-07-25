import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck, ExternalLink, Check, X, Trash2, User as UserIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Req {
  id: string;
  landlord_id: string;
  full_name: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  rejection_reason: string | null;
  id_document_path: string;
  id_back_document_path: string | null;
  proof_document_path: string | null;
  created_at: string;
}

interface ProfileLite { id: string; full_name: string | null; }

const REJECTION_REASONS = [
  "Mutna ili nečitljiva slika",
  "Pogrešan dokument (potreban osobni dokument)",
  "Podaci se ne podudaraju s profilom",
  "Dokument istekao",
  "Nedostaje stražnja strana",
  "Sumnja na falsifikat",
];

export default function AdminVerifications() {
  const { t } = useTranslation();
  const { role, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<Req[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [acting, setActing] = useState<string | null>(null);

  const [rejectFor, setRejectFor] = useState<Req | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0]);
  const [rejectNote, setRejectNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data || []) as unknown as Req[];
    setRequests(rows);

    const ids = Array.from(new Set(rows.map((r) => r.landlord_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [role]);

  if (authLoading) return null;
  if (role !== "admin") return <Navigate to="/" replace />;

  const filtered = requests.filter((r) => r.status === tab);

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("verification-docs")
      .createSignedUrl(path, 300); // 5 min expiry
    if (error || !data) {
      toast.error(error?.message || "Failed to create signed link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const approve = async (req: Req) => {
    setActing(req.id);
    const { error } = await supabase
      .from("verification_requests")
      .update({ status: "approved", admin_notes: null, rejection_reason: null } as any)
      .eq("id", req.id);
    setActing(null);
    if (error) return toast.error(error.message);
    toast.success("Korisnik verificiran. Dokumenti su obrisani (GDPR).");
    load();
  };

  const reject = async () => {
    if (!rejectFor) return;
    setActing(rejectFor.id);
    const { error } = await supabase
      .from("verification_requests")
      .update({
        status: "rejected",
        rejection_reason: rejectReason,
        admin_notes: rejectNote.trim() || null,
      } as any)
      .eq("id", rejectFor.id);
    setActing(null);
    if (error) return toast.error(error.message);
    toast.success("Zahtjev odbijen.");
    setRejectFor(null);
    setRejectNote("");
    setRejectReason(REJECTION_REASONS[0]);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Verifikacijski Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Pregled, odobrenje i odbijanje KYC zahtjeva korisnika.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">
              Na čekanju ({requests.filter((r) => r.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="approved">Odobreni</TabsTrigger>
            <TabsTrigger value="rejected">Odbijeni</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4 space-y-3">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                Nema zahtjeva u ovoj kategoriji.
              </Card>
            ) : (
              filtered.map((req) => {
                const profileName = profiles[req.landlord_id]?.full_name;
                const nameMatches =
                  profileName && profileName.trim().toLowerCase() === req.full_name.trim().toLowerCase();
                return (
                  <Card key={req.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{req.full_name}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          Profil: {profileName || "—"}{" "}
                          {profileName && (
                            <span className={nameMatches ? "text-primary" : "text-destructive"}>
                              {nameMatches ? "(podudara se)" : "(NE podudara se)"}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Zaprimljeno {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      {req.status !== "approved" && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDoc(req.id_document_path)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Prednja strana
                          </Button>
                          {req.id_back_document_path && (
                            <Button size="sm" variant="outline" onClick={() => openDoc(req.id_back_document_path!)}>
                              <ExternalLink className="h-3.5 w-3.5" />
                              Stražnja strana
                            </Button>
                          )}
                          {req.proof_document_path && (
                            <Button size="sm" variant="outline" onClick={() => openDoc(req.proof_document_path!)}>
                              <ExternalLink className="h-3.5 w-3.5" />
                              Dokaz adrese
                            </Button>
                          )}
                        </div>
                      )}
                      {req.status === "approved" && (
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Trash2 className="h-3 w-3" />
                          Dokumenti obrisani (GDPR)
                        </p>
                      )}
                    </div>

                    {req.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={rejectFor?.id === req.id}
                          onOpenChange={(o) => !o && setRejectFor(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => setRejectFor(req)}
                              disabled={acting === req.id}
                            >
                              <X className="h-4 w-4" />
                              Odbij
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Odbij verifikaciju</DialogTitle>
                              <DialogDescription>
                                Korisnik će dobiti obavijest s razlogom i moći će ponoviti proces.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium">Razlog</label>
                                <Select value={rejectReason} onValueChange={setRejectReason}>
                                  <SelectTrigger className="mt-1.5">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {REJECTION_REASONS.map((r) => (
                                      <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-sm font-medium">
                                  Dodatna napomena (neobavezno)
                                </label>
                                <Textarea
                                  value={rejectNote}
                                  onChange={(e) => setRejectNote(e.target.value)}
                                  rows={3}
                                  maxLength={500}
                                  className="mt-1.5"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRejectFor(null)}>
                                Odustani
                              </Button>
                              <Button onClick={reject} disabled={acting === req.id}>
                                {acting === req.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                Pošalji odbijenicu
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          onClick={() => approve(req)}
                          disabled={acting === req.id}
                        >
                          {acting === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Odobri
                        </Button>
                      </div>
                    )}

                    {req.status === "rejected" && (req.rejection_reason || req.admin_notes) && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Razlog:</span>{" "}
                        {req.rejection_reason || req.admin_notes}
                      </p>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
