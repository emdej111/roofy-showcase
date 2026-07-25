import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Save } from "lucide-react";

type Rate = {
  id: string;
  city: string;
  income_tax_rate: number;
  surtax_rate: number;
  lump_sum_deduction_rate: number;
};

export default function AdminTaxRates() {
  const [rows, setRows] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRow, setNewRow] = useState({ city: "", income_tax_rate: 12, surtax_rate: 0, lump_sum_deduction_rate: 30 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("city_tax_rates").select("*").order("city");
    setRows((data as Rate[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("city_tax_rates_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "city_tax_rates" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async (r: Rate) => {
    const { error } = await supabase.from("city_tax_rates").update({
      city: r.city,
      income_tax_rate: r.income_tax_rate,
      surtax_rate: r.surtax_rate,
      lump_sum_deduction_rate: r.lump_sum_deduction_rate,
    }).eq("id", r.id);
    if (error) toast.error(error.message); else toast.success("Spremljeno");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("city_tax_rates").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Obrisano"); load(); }
  };

  const add = async () => {
    if (!newRow.city.trim()) return toast.error("Unesite naziv grada");
    const { error } = await supabase.from("city_tax_rates").insert(newRow);
    if (error) toast.error(error.message);
    else {
      toast.success("Dodano");
      setNewRow({ city: "", income_tax_rate: 12, surtax_rate: 0, lump_sum_deduction_rate: 30 });
      load();
    }
  };

  const updateLocal = (id: string, patch: Partial<Rate>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Admin — Porezne stope" description="Upravljanje poreznim stopama po gradovima" />
      <Navbar />
      <main className="container py-8 space-y-6">
        <h1 className="text-2xl font-bold">Porezne stope po gradovima</h1>

        <Card>
          <CardHeader><CardTitle>Dodaj grad</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
              <div className="space-y-1.5">
                <Label>Grad</Label>
                <Input value={newRow.city} onChange={(e) => setNewRow({ ...newRow, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Porez %</Label>
                <Input type="number" step="0.01" value={newRow.income_tax_rate}
                  onChange={(e) => setNewRow({ ...newRow, income_tax_rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prirez %</Label>
                <Input type="number" step="0.01" value={newRow.surtax_rate}
                  onChange={(e) => setNewRow({ ...newRow, surtax_rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Paušal %</Label>
                <Input type="number" step="0.01" value={newRow.lump_sum_deduction_rate}
                  onChange={(e) => setNewRow({ ...newRow, lump_sum_deduction_rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <Button onClick={add}><Plus className="h-4 w-4" />Dodaj</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Postojeće stope</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Učitavanje…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grad</TableHead>
                    <TableHead>Porez %</TableHead>
                    <TableHead>Prirez %</TableHead>
                    <TableHead>Paušal %</TableHead>
                    <TableHead className="w-[160px]">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Input value={r.city} onChange={(e) => updateLocal(r.id, { city: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.income_tax_rate}
                        onChange={(e) => updateLocal(r.id, { income_tax_rate: parseFloat(e.target.value) || 0 })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.surtax_rate}
                        onChange={(e) => updateLocal(r.id, { surtax_rate: parseFloat(e.target.value) || 0 })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.lump_sum_deduction_rate}
                        onChange={(e) => updateLocal(r.id, { lump_sum_deduction_rate: parseFloat(e.target.value) || 0 })} /></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => save(r)}><Save className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
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
