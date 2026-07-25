import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Trash2, ArrowLeft } from "lucide-react";
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
  is_active: boolean;
  headline: string;
  bio: string;
  age: string;
  gender: string;
  occupation: string;
  city: string;
  neighborhood: string;
  budget_min: string;
  budget_max: string;
  move_in_date: string;
  rental_period_months: string;
  smoker: boolean;
  pets: boolean;
  pets_ok: boolean;
  lifestyle: string;
  cleanliness: string;
  preferred_gender: string;
  listing_id: string;
};

const empty: Form = {
  is_active: true, headline: "", bio: "", age: "", gender: "", occupation: "",
  city: "", neighborhood: "", budget_min: "", budget_max: "", move_in_date: "",
  rental_period_months: "", smoker: false, pets: false, pets_ok: true,
  lifestyle: "", cleanliness: "", preferred_gender: "", listing_id: "",
};

const NONE = "__none__";

export default function RoommateEdit() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<Form>(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [existRes, listingsRes] = await Promise.all([
        supabase.from("roommate_profiles" as any).select("*").eq("user_id", user.id).maybeSingle(),
        role === "landlord"
          ? supabase.from("listings").select("id, title").eq("landlord_id", user.id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] } as any),
      ]);
      if (existRes.data) {
        const r = existRes.data as any;
        setExistingId(r.id);
        setForm({
          is_active: r.is_active, headline: r.headline ?? "", bio: r.bio ?? "",
          age: r.age?.toString() ?? "", gender: r.gender ?? "", occupation: r.occupation ?? "",
          city: r.city ?? "", neighborhood: r.neighborhood ?? "",
          budget_min: r.budget_min?.toString() ?? "", budget_max: r.budget_max?.toString() ?? "",
          move_in_date: r.move_in_date ?? "",
          rental_period_months: r.rental_period_months?.toString() ?? "",
          smoker: r.smoker, pets: r.pets, pets_ok: r.pets_ok,
          lifestyle: r.lifestyle ?? "", cleanliness: r.cleanliness ?? "",
          preferred_gender: r.preferred_gender ?? "", listing_id: r.listing_id ?? "",
        });
      }
      setMyListings((listingsRes.data as any) || []);
      setLoading(false);
    })();
  }, [user, role]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!user) return;
    if (!form.headline.trim() || form.headline.trim().length < 5) {
      return toast.error(t("roommates.needHeadline", "Naslov mora imati barem 5 znakova."));
    }
    if (!form.city.trim()) {
      return toast.error(t("roommates.needCity", "Grad je obavezan."));
    }
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      is_active: form.is_active,
      headline: form.headline.trim(),
      bio: form.bio.trim() || null,
      age: form.age ? parseInt(form.age, 10) : null,
      gender: form.gender || null,
      occupation: form.occupation || null,
      city: form.city.trim(),
      neighborhood: form.neighborhood.trim() || null,
      budget_min: form.budget_min ? parseInt(form.budget_min, 10) : null,
      budget_max: form.budget_max ? parseInt(form.budget_max, 10) : null,
      move_in_date: form.move_in_date || null,
      rental_period_months: form.rental_period_months ? parseInt(form.rental_period_months, 10) : null,
      smoker: form.smoker,
      pets: form.pets,
      pets_ok: form.pets_ok,
      lifestyle: form.lifestyle || null,
      cleanliness: form.cleanliness || null,
      preferred_gender: form.preferred_gender || null,
      listing_id: form.listing_id || null,
    };
    const { error } = existingId
      ? await supabase.from("roommate_profiles" as any).update(payload).eq("id", existingId)
      : await supabase.from("roommate_profiles" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("roommates.saved", "Cimer profil spremljen."));
    navigate("/roommates");
  };

  const remove = async () => {
    if (!existingId) return;
    if (!confirm(t("roommates.confirmDelete", "Sigurno želiš obrisati svoj cimer profil?"))) return;
    const { error } = await supabase.from("roommate_profiles" as any).delete().eq("id", existingId);
    if (error) return toast.error(error.message);
    toast.success(t("roommates.deleted", "Profil obrisan."));
    navigate("/roommates");
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
      <SEO title={t("roommates.editTitle", "Uredi cimer profil") + " · Roofy"} description="" />
      <Navbar />
      <main className="container max-w-2xl py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/roommates")} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> {t("common.back", "Natrag")}
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {existingId ? t("roommates.editTitle", "Uredi cimer profil") : t("roommates.createTitle", "Kreiraj cimer profil")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("roommates.editSubtitle", "Popuni podatke kako bi te potencijalni cimeri lakše pronašli.")}
        </p>

        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{t("roommates.visible", "Vidljivo drugima")}</p>
              <p className="text-xs text-muted-foreground">
                {t("roommates.visibleHint", "Isključi ako trenutno ne tražiš.")}
              </p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <Label>{t("roommates.headline", "Naslov")} *</Label>
              <Input
                value={form.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder={t("roommates.headlinePh", "Studentica traži mirnog cimera u Zagrebu")}
                maxLength={120}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t("roommates.bio", "O meni")}</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder={t("roommates.bioPh", "Ispričaj nešto o sebi, navikama, hobijima…")}
                rows={4}
                maxLength={1000}
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>{t("roommates.age", "Dob")}</Label>
                <Input type="number" min={16} max={100} value={form.age} onChange={(e) => set("age", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("roommates.gender", "Spol")}</Label>
                <Select value={form.gender || NONE} onValueChange={(v) => set("gender", v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="female">{t("roommates.female", "Žensko")}</SelectItem>
                    <SelectItem value="male">{t("roommates.male", "Muško")}</SelectItem>
                    <SelectItem value="other">{t("roommates.other", "Ostalo")}</SelectItem>
                    <SelectItem value="prefer_not_say">{t("roommates.preferNotSay", "Ne želim reći")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("roommates.occupation", "Zanimanje")}</Label>
                <Select value={form.occupation || NONE} onValueChange={(v) => set("occupation", v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="student">{t("roommates.student", "Student")}</SelectItem>
                    <SelectItem value="employed">{t("roommates.employed", "Zaposlen/a")}</SelectItem>
                    <SelectItem value="self_employed">{t("roommates.selfEmployed", "Samozaposlen/a")}</SelectItem>
                    <SelectItem value="other">{t("roommates.other", "Ostalo")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("roommates.city", "Grad")} *</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Zagreb" className="mt-1.5" />
              </div>
              <div>
                <Label>{t("roommates.neighborhood", "Kvart")}</Label>
                <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Trešnjevka" className="mt-1.5" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("roommates.budgetMin", "Min. budžet €/mj")}</Label>
                <Input type="number" min={0} value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("roommates.budgetMax", "Maks. budžet €/mj")}</Label>
                <Input type="number" min={0} value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("roommates.moveIn", "Datum useljenja")}</Label>
                <Input type="date" value={form.move_in_date} onChange={(e) => set("move_in_date", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("roommates.rentalPeriod", "Trajanje (mjeseci)")}</Label>
                <Input type="number" min={1} max={120} value={form.rental_period_months} onChange={(e) => set("rental_period_months", e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("roommates.lifestyle", "Životni stil")}</Label>
                <Select value={form.lifestyle || NONE} onValueChange={(v) => set("lifestyle", v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="quiet">{t("roommates.quiet", "Tih")}</SelectItem>
                    <SelectItem value="balanced">{t("roommates.balanced", "Uravnotežen")}</SelectItem>
                    <SelectItem value="social">{t("roommates.social", "Društven")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("roommates.cleanliness", "Urednost")}</Label>
                <Select value={form.cleanliness || NONE} onValueChange={(v) => set("cleanliness", v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="relaxed">{t("roommates.relaxed", "Opušten")}</SelectItem>
                    <SelectItem value="average">{t("roommates.average", "Prosječan")}</SelectItem>
                    <SelectItem value="very_tidy">{t("roommates.very_tidy", "Vrlo uredan")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{t("roommates.preferredGender", "Traži cimera spol")}</Label>
              <Select value={form.preferred_gender || NONE} onValueChange={(v) => set("preferred_gender", v === NONE ? "" : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("roommates.anyGender", "Svejedno")}</SelectItem>
                  <SelectItem value="female">{t("roommates.female", "Žensko")}</SelectItem>
                  <SelectItem value="male">{t("roommates.male", "Muško")}</SelectItem>
                  <SelectItem value="other">{t("roommates.other", "Ostalo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.smoker} onCheckedChange={(v) => set("smoker", v)} />
                {t("roommates.imSmoker", "Pušim")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.pets} onCheckedChange={(v) => set("pets", v)} />
                {t("roommates.iHavePets", "Imam ljubimca")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.pets_ok} onCheckedChange={(v) => set("pets_ok", v)} />
                {t("roommates.petsOk", "OK mi je cimer s ljubimcem")}
              </label>
            </div>

            {myListings.length > 0 && (
              <div>
                <Label>{t("roommates.linkListing", "Poveži s oglasom (opcionalno)")}</Label>
                <Select value={form.listing_id || NONE} onValueChange={(v) => set("listing_id", v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("roommates.noListing", "Bez veze s oglasom")}</SelectItem>
                    {myListings.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("roommates.linkListingHint", "Ako imaš stan i tražiš osobu s kojom ćeš dijeliti, poveži s tvojim oglasom.")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {existingId ? (
              <Button variant="outline" onClick={remove} className="text-destructive">
                <Trash2 className="h-4 w-4" /> {t("roommates.delete", "Obriši profil")}
              </Button>
            ) : <span />}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("common.save", "Spremi")}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
