import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye, Heart, MailQuestion, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string;
  title: string;
  views: number;
  favorites: number;
  inquiries: number;
};

const DAYS = 30;

export default function Analytics() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [series, setSeries] = useState<{ date: string; views: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: listings } = await supabase
        .from("listings")
        .select("id,title")
        .eq("landlord_id", user.id);

      const ids = (listings ?? []).map((l) => l.id);
      if (ids.length === 0) {
        setRows([]);
        setSeries([]);
        setLoading(false);
        return;
      }

      const [viewsRes, favsRes, inqRes] = await Promise.all([
        supabase
          .from("listing_views")
          .select("listing_id, created_at")
          .in("listing_id", ids)
          .gte("created_at", since),
        supabase.from("favorites").select("listing_id").in("listing_id", ids),
        supabase.from("inquiries").select("listing_id").in("listing_id", ids),
      ]);

      const views = viewsRes.data ?? [];
      const favs = favsRes.data ?? [];
      const inq = inqRes.data ?? [];

      const byListing = new Map<string, Row>();
      (listings ?? []).forEach((l) =>
        byListing.set(l.id, { id: l.id, title: l.title, views: 0, favorites: 0, inquiries: 0 }),
      );
      views.forEach((v) => {
        const r = byListing.get(v.listing_id);
        if (r) r.views += 1;
      });
      favs.forEach((f) => {
        const r = byListing.get(f.listing_id);
        if (r) r.favorites += 1;
      });
      inq.forEach((i) => {
        const r = byListing.get(i.listing_id);
        if (r) r.inquiries += 1;
      });
      setRows([...byListing.values()].sort((a, b) => b.views - a.views));

      // Build daily series
      const dayMap = new Map<string, number>();
      for (let i = DAYS - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, 0);
      }
      views.forEach((v) => {
        const key = (v.created_at as string).slice(0, 10);
        if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      });
      setSeries([...dayMap.entries()].map(([date, views]) => ({
        date: date.slice(5), // MM-DD
        views,
      })));

      setLoading(false);
    })();
  }, [user]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          views: acc.views + r.views,
          favorites: acc.favorites + r.favorites,
          inquiries: acc.inquiries + r.inquiries,
        }),
        { views: 0, favorites: 0, inquiries: 0 },
      ),
    [rows],
  );

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/landlord"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Link>
        </Button>
        <h1 className="text-2xl font-bold md:text-3xl">{t("analytics.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("analytics.subtitle")}</p>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Eye className="h-4 w-4" />} label={t("analytics.totalViews")} value={totals.views} />
              <StatCard icon={<Heart className="h-4 w-4" />} label={t("analytics.totalFavorites")} value={totals.favorites} />
              <StatCard icon={<MailQuestion className="h-4 w-4" />} label={t("analytics.totalInquiries")} value={totals.inquiries} />
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-soft">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t("analytics.viewsOverTime")}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="vfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#vfill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card shadow-soft">
              <h2 className="px-4 pt-4 text-sm font-semibold text-muted-foreground">{t("analytics.perListing")}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("analytics.listing")}</TableHead>
                    <TableHead className="text-right">{t("analytics.views")}</TableHead>
                    <TableHead className="text-right">{t("analytics.favorites")}</TableHead>
                    <TableHead className="text-right">{t("analytics.inquiries")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/listing/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.views}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.favorites}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.inquiries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString("hr-HR")}</div>
    </div>
  );
}
