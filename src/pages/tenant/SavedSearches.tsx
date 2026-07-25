import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, Loader2, Search as SearchIcon, Trash2, Play } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

type SavedSearch = {
  id: string;
  name: string;
  filters: Json;
  notify_email: boolean;
  last_notified_at: string;
  created_at: string;
};

export default function SavedSearches() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as SavedSearch[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const toggleNotify = async (id: string, value: boolean) => {
    await supabase.from("saved_searches").update({ notify_email: value }).eq("id", id);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, notify_email: value } : it)));
  };

  const remove = async (id: string) => {
    await supabase.from("saved_searches").delete().eq("id", id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    toast.success(t("savedSearches.deleted"));
  };

  const apply = (s: SavedSearch) => {
    navigate("/search", { state: { savedFilters: s.filters, savedName: s.name } });
  };

  const filterSummary = (f: Json): string => {
    if (!f || typeof f !== "object" || Array.isArray(f)) return "—";
    const obj = f as Record<string, unknown>;
    const parts: string[] = [];
    if (obj.city && obj.city !== "any") parts.push(String(obj.city));
    if (Array.isArray(obj.priceRange)) parts.push(`€${obj.priceRange[0]}–${obj.priceRange[1]}`);
    if (Array.isArray(obj.sizeRange)) parts.push(`${obj.sizeRange[0]}–${obj.sizeRange[1]} m²`);
    if (obj.rooms && obj.rooms !== "any") parts.push(`${obj.rooms} ${t("search.rooms").toLowerCase()}`);
    if (obj.furnished && obj.furnished !== "any") parts.push(String(obj.furnished));
    if (obj.petsOnly) parts.push(t("listing.pets"));
    if (obj.parkingOnly) parts.push(t("listing.parking"));
    return parts.join(" · ") || "—";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("savedSearches.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("savedSearches.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link to="/search"><SearchIcon className="h-4 w-4" />{t("savedSearches.newSearch")}</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">{t("savedSearches.empty")}</p>
              <Button className="mt-4" asChild>
                <Link to="/search">{t("savedSearches.newSearch")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {items.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {s.notify_email ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      <Switch
                        checked={s.notify_email}
                        onCheckedChange={(v) => toggleNotify(s.id, v)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3 pt-0">
                  <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{filterSummary(s.filters)}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="default" size="sm" onClick={() => apply(s)}>
                      <Play className="h-4 w-4" />
                      {t("savedSearches.apply", "Primijeni")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
