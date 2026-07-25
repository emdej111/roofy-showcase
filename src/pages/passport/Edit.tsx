import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Save, ArrowLeft, Shield } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Form = {
  occupation: string;
  employer: string;
  monthly_income_eur: string;
  employment_status: string;
  household_size: string;
  has_pets: boolean;
  pet_description: string;
  smoker: boolean;
  move_in_date: string;
  desired_duration_months: string;
  bio: string;
  languages: string;
};

const empty: Form = {
  occupation: "", employer: "", monthly_income_eur: "", employment_status: "",
  household_size: "1", has_pets: false, pet_description: "", smoker: false,
  move_in_date: "", desired_duration_months: "", bio: "", languages: "",
};

const NONE = "__none__";

export default function PassportEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("renter_passports" as any).select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        const r: any = data;
        setExistingId(r.id);
        setForm({
          occupation: r.occupation ?? "",
          employer: r.employer ?? "",
          monthly_income_eur: r.monthly_income_eur?.toString() ?? "",
          employment_status: r.employment_status ?? "",
          household_size: r.household_size?.toString() ?? "1",
          has_pets: !!r.has_pets,
          pet_description: r.pet_description ?? "",
          smoker: !!r.smoker,
          move_in_date: r.move_in_date ?? "",
          desired_duration_months: r.desired_duration_months?.toString() ?? "",
          bio: r.bio ?? "",
          languages: (r.languages ?? []).join(", "),
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      occupation: form.occupation.trim() || null,
      employer: form.employer.trim() || null,
      monthly_income_eur: form.monthly_income_eur ? parseFloat(form.monthly_income_eur) : null,
      employment_status: form.employment_status || null,
      household_size: form.household_size ? parseInt(form.household_size, 10) : 1,
      has_pets: form.has_pets,
      pet_description: form.has_pets ? (form.pet_description.trim() || null) : null,
      smoker: form.smoker,
      move_in_date: form.move_in_date || null,
      desired_duration_months: form.desired_duration_months ? parseInt(form.desired_duration_months, 10) : null,
      bio: form.bio.trim() || null,
      languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const { error } = existingId
      ? await supabase.from("renter_passports" as any).update(payload).eq("id", existingId)
      : await supabase.from("renter_passports" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Putovnica najmoprimca spremljena.");
    navigate("/passport");
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

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Putovnica najmoprimca · Roofy" description="Uredi svoju putovnicu najmoprimca." />
      <Navbar />
      <main className="container max-w-2xl py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/passport")} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Natrag
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {existingId ? "Uredi putovnicu najmoprimca" : "Kreiraj putovnicu najmoprimca"}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Podaci su privatni. Najmodavac ih vidi samo kada mu odobriš pristup.
        </p>

        <Card className="mt-6 p-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Zanimanje</Label>
              <Input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Poslodavac</Label>
              <Input value={form.employer} onChange={(e) => set("employer", e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Radni status</Label>
              <Select value={form.employment_status || NONE} onValueChange={(v) => set("employment_status", v === NONE ? "" : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  <SelectItem value="employed">Zaposlen/a</SelectItem>
                  <SelectItem value="self_employed">Samozaposlen/a</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="retired">Umirovljenik</SelectItem>
                  <SelectItem value="other">Ostalo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mjesečni prihod (€)</Label>
              <Input type="number" min={0} value={form.monthly_income_eur} onChange={(e) => set("monthly_income_eur", e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Broj članova kućanstva</Label>
              <Input type="number" min={1} max={20} value={form.household_size} onChange={(e) => set("household_size", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Željeni datum useljenja</Label>
              <Input type="date" value={form.move_in_date} onChange={(e) => set("move_in_date", e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Trajanje najma (mj)</Label>
              <Input type="number" min={1} max={120} value={form.desired_duration_months} onChange={(e) => set("desired_duration_months", e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.smoker} onCheckedChange={(v) => set("smoker", v)} />
              Pušim
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.has_pets} onCheckedChange={(v) => set("has_pets", v)} />
              Imam ljubimca
            </label>
          </div>

          {form.has_pets && (
            <div>
              <Label>Opis ljubimca</Label>
              <Input value={form.pet_description} onChange={(e) => set("pet_description", e.target.value)} placeholder="npr. mali pas, 8 kg" className="mt-1.5" />
            </div>
          )}

          <div>
            <Label>Jezici (odvojeno zarezom)</Label>
            <Input value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="hrvatski, engleski" className="mt-1.5" />
          </div>

          <div>
            <Label>O meni</Label>
            <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={1000} className="mt-1.5" />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Spremi
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
