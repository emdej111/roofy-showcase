import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Users, MapPin, Calendar, Search as SearchIcon, Plus, Home } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  user_id: string;
  headline: string;
  bio: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  city: string;
  neighborhood: string | null;
  budget_min: number | null;
  budget_max: number | null;
  move_in_date: string | null;
  smoker: boolean;
  pets: boolean;
  lifestyle: string | null;
  listing_id: string | null;
  updated_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
};

const initials = (name?: string | null) =>
  (name || "U").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

export default function RoommatesList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [city, setCity] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");
  const [occupation, setOccupation] = useState<string>("all");
  const [maxBudget, setMaxBudget] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("roommate_profiles" as any)
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      if (error) {
        setLoading(false);
        return;
      }
      const list = (data as any as Row[]) || [];
      const userIds = Array.from(new Set(list.map((r) => r.user_id)));
      let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        (profs || []).forEach((p: any) => {
          profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
      }
      setRows(list.map((r) => ({ ...r, profile: profilesMap[r.user_id] ?? null })));

      const mine = list.find((r) => r.user_id === user.id);
      setMyProfileId(mine?.id ?? null);
      setLoading(false);
    })();
  }, [user]);

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const budget = maxBudget ? parseInt(maxBudget, 10) : null;
    return rows.filter((r) => {
      if (city !== "all" && r.city !== city) return false;
      if (gender !== "all" && r.gender !== gender) return false;
      if (occupation !== "all" && r.occupation !== occupation) return false;
      if (budget && r.budget_max && r.budget_max > budget) return false;
      if (needle) {
        const hay = `${r.headline} ${r.bio ?? ""} ${r.city} ${r.neighborhood ?? ""} ${r.profile?.full_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, city, gender, occupation, maxBudget]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("roommates.title", "Cimeri") + " · Roofy"}
        description={t("roommates.metaDesc", "Pronađi cimera za zajedničko stanovanje u Hrvatskoj.")}
      />
      <Navbar />
      <main className="container max-w-6xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Users className="h-6 w-6" /> {t("roommates.title", "Cimeri")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "roommates.subtitle",
                "Pronađi osobu s kojom ćeš dijeliti stan. Dostupno samo prijavljenim korisnicima."
              )}
            </p>
          </div>
          <Button onClick={() => navigate("/roommates/edit")}>
            <Plus className="h-4 w-4" />
            {myProfileId
              ? t("roommates.editMine", "Uredi moj profil")
              : t("roommates.createMine", "Kreiraj moj cimer profil")}
          </Button>
        </div>

        <Card className="mt-6 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label className="text-xs">{t("common.search", "Pretraži")}</Label>
              <div className="relative mt-1">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("roommates.searchPh", "Ime, kvart, ključne riječi…")}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("roommates.city", "Grad")}</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all", "Svi")}</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("roommates.gender", "Spol")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all", "Svi")}</SelectItem>
                  <SelectItem value="female">{t("roommates.female", "Žensko")}</SelectItem>
                  <SelectItem value="male">{t("roommates.male", "Muško")}</SelectItem>
                  <SelectItem value="other">{t("roommates.other", "Ostalo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("roommates.maxBudget", "Maks. budžet €")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="500"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-5">
              <Label className="text-xs">{t("roommates.occupation", "Zanimanje")}</Label>
              <Select value={occupation} onValueChange={setOccupation}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all", "Svi")}</SelectItem>
                  <SelectItem value="student">{t("roommates.student", "Student")}</SelectItem>
                  <SelectItem value="employed">{t("roommates.employed", "Zaposlen/a")}</SelectItem>
                  <SelectItem value="self_employed">{t("roommates.selfEmployed", "Samozaposlen/a")}</SelectItem>
                  <SelectItem value="other">{t("roommates.other", "Ostalo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="mt-6 p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t("roommates.empty", "Nema rezultata koji odgovaraju filterima.")}
            </p>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/roommates/${r.id}`}
                className="group"
              >
                <Card className="flex h-full flex-col p-5 transition hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-1 ring-border">
                      {r.profile?.avatar_url ? (
                        <AvatarImage src={r.profile.avatar_url} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="bg-foreground text-background">
                        {initials(r.profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.profile?.full_name || t("roommates.anonymous", "Korisnik")}
                        {r.age ? <span className="text-muted-foreground">, {r.age}</span> : null}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {r.city}{r.neighborhood ? ` · ${r.neighborhood}` : ""}
                      </p>
                    </div>
                  </div>

                  <h3 className="mt-4 line-clamp-2 font-semibold group-hover:text-accent">
                    {r.headline}
                  </h3>
                  {r.bio && (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.bio}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {r.budget_max ? (
                      <Badge variant="secondary">
                        {r.budget_min ? `${r.budget_min}–${r.budget_max}` : `≤ ${r.budget_max}`} €
                      </Badge>
                    ) : null}
                    {r.occupation ? <Badge variant="outline">{String(t(`roommates.${r.occupation}`, { defaultValue: r.occupation }))}</Badge> : null}
                    {r.lifestyle ? <Badge variant="outline">{String(t(`roommates.${r.lifestyle}`, { defaultValue: r.lifestyle }))}</Badge> : null}
                    {r.smoker ? <Badge variant="outline">{t("roommates.smoker", "Puši")}</Badge> : null}
                    {r.pets ? <Badge variant="outline">{t("roommates.hasPets", "Ljubimci")}</Badge> : null}
                    {r.listing_id ? (
                      <Badge className="gap-1"><Home className="h-3 w-3" />{t("roommates.hasListing", "Ima stan")}</Badge>
                    ) : null}
                  </div>

                  {r.move_in_date && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {t("roommates.moveIn", "Useljenje")}: {new Date(r.move_in_date).toLocaleDateString("hr-HR")}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
