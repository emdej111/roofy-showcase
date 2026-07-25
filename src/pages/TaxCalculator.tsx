import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Calculator, Info } from "lucide-react";

type CityRate = {
  id: string;
  city: string;
  income_tax_rate: number;
  surtax_rate: number;
  lump_sum_deduction_rate: number;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v || 0);

export default function TaxCalculator() {
  const [rates, setRates] = useState<CityRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyRent, setMonthlyRent] = useState<number>(600);
  const [months, setMonths] = useState<number>(12);
  const [cityId, setCityId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("city_tax_rates")
        .select("*")
        .order("city");
      if (!error && data) {
        setRates(data as CityRate[]);
        if (data.length) setCityId(data[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const selected = useMemo(() => rates.find((r) => r.id === cityId), [rates, cityId]);

  const calc = useMemo(() => {
    if (!selected) return null;
    const gross = (Number(monthlyRent) || 0) * (Number(months) || 0);
    const lumpRate = Number(selected.lump_sum_deduction_rate) / 100;
    const incomeRate = Number(selected.income_tax_rate) / 100;
    const surtaxRate = Number(selected.surtax_rate) / 100;

    const deduction = gross * lumpRate;
    const taxableBase = gross - deduction;
    const incomeTax = taxableBase * incomeRate;
    const surtax = incomeTax * surtaxRate;
    const totalTax = incomeTax + surtax;
    const net = gross - totalTax;
    const effective = gross > 0 ? (totalTax / gross) * 100 : 0;
    return { gross, deduction, taxableBase, incomeTax, surtax, totalTax, net, effective };
  }, [selected, monthlyRent, months]);

  const pieData = calc
    ? [
        { name: "Čista dobit", value: Math.max(calc.net, 0) },
        { name: "Porezna davanja", value: Math.max(calc.totalTax, 0) },
      ]
    : [];

  const barData = calc
    ? [
        { name: "Bruto", iznos: calc.gross },
        { name: "Paušal 30%", iznos: calc.deduction },
        { name: "Osnovica", iznos: calc.taxableBase },
        { name: "Porez", iznos: calc.incomeTax },
        { name: "Prirez", iznos: calc.surtax },
        { name: "Neto", iznos: calc.net },
      ]
    : [];

  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"];

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Kalkulator poreza i dobiti od najma" description="Izračunajte neto dobit od najma nekretnine u Hrvatskoj." />
      <Navbar />
      <main className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kalkulator poreza i dobiti</h1>
            <p className="text-sm text-muted-foreground">Procjena neto prihoda od najma za hrvatska tržišta</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>Parametri</CardTitle>
              <CardDescription>Unesite podatke o najmu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rent">Mjesečna najamnina (EUR)</Label>
                <Input
                  id="rent" type="number" min={0} value={monthlyRent}
                  onChange={(e) => setMonthlyRent(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="months">Trajanje ugovora (mjeseci)</Label>
                <Input
                  id="months" type="number" min={1} value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Lokacija (grad)</Label>
                <Select value={cityId} onValueChange={setCityId} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Odaberi grad" /></SelectTrigger>
                  <SelectContent>
                    {rates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selected && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="h-3.5 w-3.5" /> Stope za {selected.city}
                  </div>
                  <div>Paušalno umanjenje: <strong className="text-foreground">{selected.lump_sum_deduction_rate}%</strong></div>
                  <div>Porez na dohodak: <strong className="text-foreground">{selected.income_tax_rate}%</strong></div>
                  <div>Prirez: <strong className="text-foreground">{selected.surtax_rate}%</strong></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Bruto prihod" value={calc ? fmt(calc.gross) : "—"} />
              <StatCard label="Porezna davanja" value={calc ? fmt(calc.totalTax) : "—"} accent="destructive" />
              <StatCard label="Čista dobit" value={calc ? fmt(calc.net) : "—"} accent="primary" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vizualizacija</CardTitle>
                <CardDescription>
                  {calc && `Efektivna porezna stopa: ${calc.effective.toFixed(2)}%`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pie">
                  <TabsList>
                    <TabsTrigger value="pie">Pita</TabsTrigger>
                    <TabsTrigger value="bar">Stupci</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pie" className="mt-4">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                               outerRadius={110} innerRadius={60} paddingAngle={2}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                          </Pie>
                          <RTooltip formatter={(v: number) => fmt(v)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  <TabsContent value="bar" className="mt-4">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <RTooltip formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="iznos" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {calc && (
              <Card>
                <CardHeader><CardTitle>Detalji izračuna</CardTitle></CardHeader>
                <CardContent>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <Row k="Bruto prihod (najamnina × mjeseci)" v={fmt(calc.gross)} />
                    <Row k={`Paušalno umanjenje (${selected?.lump_sum_deduction_rate}%)`} v={`− ${fmt(calc.deduction)}`} />
                    <Row k="Porezna osnovica" v={fmt(calc.taxableBase)} />
                    <Row k={`Porez na dohodak (${selected?.income_tax_rate}%)`} v={fmt(calc.incomeTax)} />
                    <Row k={`Prirez (${selected?.surtax_rate}%)`} v={fmt(calc.surtax)} />
                    <Row k="Ukupna davanja" v={fmt(calc.totalTax)} />
                    <Row k="Neto dobit" v={fmt(calc.net)} bold />
                  </dl>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Informativni izračun. Stvarna obveza ovisi o vašoj poreznoj situaciji.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "primary" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-bold ${
          accent === "primary" ? "text-primary" : accent === "destructive" ? "text-destructive" : ""
        }`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-border/60 py-1.5 ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
