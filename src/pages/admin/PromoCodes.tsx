import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Copy, Tag, Plus } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface PromoCode {
  id: string;
  code: string;
  batch_label: string | null;
  kind: string;
  max_uses: number;
  times_used: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export default function AdminPromoCodes() {
  const { role, loading: authLoading } = useAuth();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batchLabel, setBatchLabel] = useState("PROLJECE2026");
  const [kind, setKind] = useState<"listing_free" | "agency_month">("listing_free");
  const [count, setCount] = useState(10);
  const [expiresAt, setExpiresAt] = useState("");
  const [filterBatch, setFilterBatch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setCodes((data ?? []) as PromoCode[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-promo-codes", {
        body: {
          batch_label: batchLabel,
          kind,
          count,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      });
      if (error) throw error;
      toast.success(`Generirano ${data?.codes?.length ?? 0} kodova`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška");
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = (filter?: string) => {
    const list = codes.filter((c) => !filter || c.batch_label === filter).map((c) => c.code).join("\n");
    navigator.clipboard.writeText(list);
    toast.success("Kopirano u međuspremnik");
  };

  const filtered = filterBatch ? codes.filter((c) => c.batch_label === filterBatch) : codes;
  const batches = Array.from(new Set(codes.map((c) => c.batch_label).filter(Boolean))) as string[];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />Promo kodovi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generiraj pakete kodova za besplatne objave i agencijske vaučere.
          </p>
        </header>

        <Card>
          <CardHeader><CardTitle className="text-base">Novi paket</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Naziv paketa</Label>
              <Input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value.toUpperCase())} maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="listing_free">Besplatna objava</SelectItem>
                  <SelectItem value="agency_month">Agencija — mjesec dana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Količina</Label>
              <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Ističe (opcionalno)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={generate} disabled={generating || !batchLabel} className="w-full">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generiraj
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={!filterBatch ? "default" : "outline"} onClick={() => setFilterBatch("")}>
            Svi ({codes.length})
          </Button>
          {batches.map((b) => (
            <Button key={b} size="sm" variant={filterBatch === b ? "default" : "outline"} onClick={() => setFilterBatch(b)}>
              {b} ({codes.filter((c) => c.batch_label === b).length})
            </Button>
          ))}
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={() => copyAll(filterBatch || undefined)}>
              <Copy className="h-4 w-4" />Kopiraj sve
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <code className="font-mono font-semibold">{c.code}</code>
                  <Badge variant={c.kind === "agency_month" ? "default" : "secondary"} className="text-[10px]">
                    {c.kind === "agency_month" ? "Agencija/mj" : "Objava"}
                  </Badge>
                  {c.times_used >= c.max_uses && <Badge variant="outline">Iskorišten</Badge>}
                  {c.expires_at && new Date(c.expires_at) < new Date() && <Badge variant="destructive">Istekao</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c.times_used}/{c.max_uses}</span>
                  <span>{format(new Date(c.created_at), "dd.MM.yyyy")}</span>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Kopirano"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
