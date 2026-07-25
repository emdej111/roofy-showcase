import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Loader2, MapPin, Calendar, Home, MessageSquare, Cigarette, PawPrint, Sparkles, Send,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const initials = (name?: string | null) =>
  (name || "U").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

export default function RoommateDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, fullName } = useAuth();
  const navigate = useNavigate();

  const [row, setRow] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [contactOpen, setContactOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("roommate_profiles" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      setRow(data);
      const [{ data: prof }, listingRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, phone").eq("id", (data as any).user_id).maybeSingle(),
        (data as any).listing_id
          ? supabase.from("listings").select("id, title, city, price, cover_photo_url, slug").eq("id", (data as any).listing_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setProfile(prof);
      setListing(listingRes.data);
      setLoading(false);
    })();
  }, [id]);

  const isMine = user && row && user.id === row.user_id;

  const sendContact = async () => {
    if (!user || !row) return;
    if (msg.trim().length < 5) {
      toast.error(t("roommates.msgTooShort", "Poruka mora imati barem 5 znakova."));
      return;
    }
    setSending(true);
    const senderName = fullName || user.email?.split("@")[0] || t("roommates.anonymous", "Korisnik");
    const { error } = await supabase.from("notifications").insert({
      user_id: row.user_id,
      type: "message",
      title: `${senderName} ${t("roommates.wantsToConnect", "želi biti tvoj cimer")}`,
      body: msg.trim().slice(0, 500),
      link: `/roommates/${row.id}`,
      metadata: { kind: "roommate_contact", sender_id: user.id, roommate_profile_id: row.id },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(t("roommates.msgSent", "Poruka poslana!"));
    setContactOpen(false);
    setMsg("");
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
  if (!row) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-2xl py-20 text-center">
          <p className="text-muted-foreground">{t("roommates.notFound", "Cimer profil ne postoji.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/roommates")}>
            <ArrowLeft className="h-4 w-4" /> {t("common.back", "Natrag")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${row.headline} · Roofy`} description={row.bio ?? row.headline} />
      <Navbar />
      <main className="container max-w-3xl py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> {t("common.back", "Natrag")}
        </Button>

        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-1 ring-border">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} className="object-cover" /> : null}
                <AvatarFallback className="bg-foreground text-background text-lg">
                  {initials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">
                  {profile?.full_name || t("roommates.anonymous", "Korisnik")}
                  {row.age ? <span className="text-muted-foreground">, {row.age}</span> : null}
                </h1>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {row.city}{row.neighborhood ? ` · ${row.neighborhood}` : ""}
                </p>
              </div>
            </div>
            {isMine ? (
              <Button variant="outline" onClick={() => navigate("/roommates/edit")}>
                {t("roommates.editMine", "Uredi moj profil")}
              </Button>
            ) : user ? (
              <Button onClick={() => setContactOpen(true)}>
                <MessageSquare className="h-4 w-4" /> {t("roommates.contact", "Kontaktiraj")}
              </Button>
            ) : (
              <Button onClick={() => navigate("/auth/login")}>
                {t("roommates.loginToContact", "Prijavi se za kontakt")}
              </Button>
            )}
          </div>

          <h2 className="mt-6 text-lg font-semibold">{row.headline}</h2>
          {row.bio && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{row.bio}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {row.budget_max ? (
              <Badge variant="secondary">
                {row.budget_min ? `${row.budget_min}–${row.budget_max}` : `≤ ${row.budget_max}`} €/mj
              </Badge>
            ) : null}
            {row.occupation ? <Badge variant="outline">{String(t(`roommates.${row.occupation}`, { defaultValue: row.occupation }))}</Badge> : null}
            {row.gender ? <Badge variant="outline">{String(t(`roommates.${row.gender}`, { defaultValue: row.gender }))}</Badge> : null}
            {row.lifestyle ? (
              <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" />{String(t(`roommates.${row.lifestyle}`, { defaultValue: row.lifestyle }))}</Badge>
            ) : null}
            {row.cleanliness ? <Badge variant="outline">{String(t(`roommates.${row.cleanliness}`, { defaultValue: row.cleanliness }))}</Badge> : null}
            {row.smoker ? <Badge variant="outline" className="gap-1"><Cigarette className="h-3 w-3" />{t("roommates.smoker", "Puši")}</Badge> : null}
            {row.pets ? <Badge variant="outline" className="gap-1"><PawPrint className="h-3 w-3" />{t("roommates.hasPets", "Ima ljubimca")}</Badge> : null}
            {!row.pets_ok ? <Badge variant="outline">{t("roommates.noPetsOk", "Bez ljubimaca")}</Badge> : null}
          </div>

          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            {row.move_in_date && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("roommates.moveIn", "Useljenje")}</dt>
                <dd className="mt-1 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(row.move_in_date).toLocaleDateString("hr-HR")}</dd>
              </div>
            )}
            {row.rental_period_months && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("roommates.rentalPeriod", "Trajanje najma")}</dt>
                <dd className="mt-1">{row.rental_period_months} {t("roommates.months", "mjeseci")}</dd>
              </div>
            )}
            {row.preferred_gender && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("roommates.preferredGender", "Traži cimera spol")}</dt>
                <dd className="mt-1">{String(t(`roommates.${row.preferred_gender}`, { defaultValue: row.preferred_gender }))}</dd>
              </div>
            )}
          </dl>
        </Card>

        {listing && (
          <Card className="mt-4 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("roommates.linkedListing", "Vezano za oglas")}
            </p>
            <Link
              to={`/listing/${listing.id}`}
              className="mt-3 flex items-center gap-4 rounded-lg border p-3 transition hover:bg-muted/50"
            >
              {listing.cover_photo_url ? (
                <img src={listing.cover_photo_url} alt="" className="h-16 w-24 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded bg-muted"><Home className="h-5 w-5 text-muted-foreground" /></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{listing.title}</p>
                <p className="text-xs text-muted-foreground">{listing.city} · {listing.price} €/mj</p>
              </div>
            </Link>
          </Card>
        )}
      </main>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("roommates.contactTitle", "Pošalji poruku")} — {profile?.full_name || t("roommates.anonymous", "Korisnik")}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={t("roommates.contactPh", "Predstavi se ukratko i napiši zašto misliš da biste bili dobri cimeri…")}
            rows={5}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            {t("roommates.contactHint", "Osoba će dobiti obavijest s tvojim imenom i porukom.")} ({msg.length}/500)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>{t("common.cancel", "Odustani")}</Button>
            <Button onClick={sendContact} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("common.send", "Pošalji")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
