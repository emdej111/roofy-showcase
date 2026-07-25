import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, ShieldCheck, ShieldAlert, Ban, CheckCircle2 } from "lucide-react";

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_verified: boolean;
  banned: boolean;
  created_at: string;
  latestStatus?: "pending" | "approved" | "rejected" | null;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: landlordIds } = await supabase
      .from("user_roles" as any)
      .select("user_id")
      .eq("role", "landlord");
    const ids = (landlordIds || []).map((r: any) => r.user_id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone, is_verified, banned, created_at").in("id", ids);
    const { data: vrs } = await supabase.from("verification_requests").select("landlord_id, status, created_at").in("landlord_id", ids).order("created_at", { ascending: false });

    const latest = new Map<string, Row["latestStatus"]>();
    (vrs || []).forEach((r: any) => { if (!latest.has(r.landlord_id)) latest.set(r.landlord_id, r.status); });

    setRows(((profiles as any[]) || []).map((p) => ({ ...p, latestStatus: latest.get(p.id) ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.full_name || "").toLowerCase().includes(s) || (r.phone || "").includes(s));
  }, [rows, q]);

  const setVerified = async (id: string, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_verified: value }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(value ? "Verificiran" : "Verifikacija uklonjena"); load(); }
  };

  const setBanned = async (id: string, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ banned: value }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(value ? "Korisnik blokiran" : "Blokada uklonjena"); load(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Admin — Korisnici" description="Upravljanje stanodavcima" />
      <Navbar />
      <main className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stanodavci</h1>
            <p className="text-sm text-muted-foreground">Status verifikacije i blokade</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Lista korisnika ({rows.length})</CardTitle>
              <Input placeholder="Pretraži po imenu ili broju" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Učitavanje…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ime</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Verifikacija</TableHead>
                    <TableHead>KYC zahtjev</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[260px]">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                      <TableCell>{r.phone || "—"}</TableCell>
                      <TableCell>
                        {r.is_verified ? (
                          <Badge><ShieldCheck className="h-3 w-3" /> Verificiran</Badge>
                        ) : (
                          <Badge variant="secondary"><ShieldAlert className="h-3 w-3" /> Nije</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.latestStatus ? <Badge variant="outline">{r.latestStatus}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {r.banned ? <Badge variant="destructive">Blokiran</Badge> : <Badge variant="outline">Aktivan</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {r.is_verified ? (
                            <Button size="sm" variant="outline" onClick={() => setVerified(r.id, false)}>Ukloni verifikaciju</Button>
                          ) : (
                            <Button size="sm" onClick={() => setVerified(r.id, true)}><CheckCircle2 className="h-4 w-4" />Odobri</Button>
                          )}
                          {r.banned ? (
                            <Button size="sm" variant="outline" onClick={() => setBanned(r.id, false)}>Odblokiraj</Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setBanned(r.id, true)}><Ban className="h-4 w-4" />Blokiraj</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
