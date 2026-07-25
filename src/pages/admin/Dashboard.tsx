import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, ShieldCheck, Gavel, FileText, Users, LayoutDashboard, Tag } from "lucide-react";

const tiles = [
  { to: "/admin/tax-rates", icon: Calculator, title: "Porezne stope", desc: "Upravljaj poreznim stopama po gradovima i općinama" },
  { to: "/admin/verifications", icon: ShieldCheck, title: "Verifikacije (KYC)", desc: "Odobri ili odbij dokumente stanodavaca" },
  { to: "/admin/users", icon: Users, title: "Korisnici", desc: "Pregled stanodavaca i statusa verifikacije" },
  { to: "/admin/documents", icon: FileText, title: "Dokument Manager", desc: "Upload PDF/Word predložaka ugovora" },
  { to: "/admin/moderation", icon: Gavel, title: "Moderacija", desc: "Odobravanje oglasa i pregled prijava" },
  { to: "/admin/promo-codes", icon: Tag, title: "Promo kodovi", desc: "Generiraj kodove za besplatne objave i agencijske vaučere" },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Admin dashboard" description="Administracija aplikacije" />
      <Navbar />
      <main className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin sučelje</h1>
            <p className="text-sm text-muted-foreground">Upravljanje aplikacijom</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <t.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{t.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{t.desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
