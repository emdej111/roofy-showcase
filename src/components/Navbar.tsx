import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home, LogOut, Heart, LayoutDashboard, Search, MessageSquare,
  Sparkles, ShieldCheck, Gavel, BellRing, Globe, Menu, User as UserIcon, Users, Map as MapIcon, Calculator, BadgeCheck, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function initials(nameOrEmail?: string | null) {
  if (!nameOrEmail) return "U";
  const base = nameOrEmail.split("@")[0];
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "U").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, role, isVerified, avatarUrl, fullName, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success(t("auth.logoutSuccess"));
    navigate("/");
  };

  const changeLang = (lng: "hr" | "en") => i18n.changeLanguage(lng);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
      isActive
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    );

  // Lock the navigation down to verification only when the user is logged in but
  // has not yet been approved by an admin. Admins always have full nav.
  const needsVerification = !!user && role !== "admin" && !isVerified;

  const primaryLinks: { to: string; label: string; icon: React.ElementType }[] = [];

  if (needsVerification) {
    primaryLinks.push({ to: "/verify", label: t("verification.nav", "Verifikacija"), icon: ShieldCheck });
  } else {
    // Public only: explore map of all listings (tenants already have /search)
    if (!user) {
      primaryLinks.push({ to: "/explore", label: t("common.mapExplorer", "Istraži kartu"), icon: MapIcon });
    }

    if (role === "admin") {
      primaryLinks.push({ to: "/admin/tax-rates", label: t("common.adminTaxRates", "Porezne stope"), icon: Calculator });
    }

    if (user) {
      if (role === "tenant") {
        primaryLinks.push({ to: "/search", label: t("common.search"), icon: Search });
        primaryLinks.push({ to: "/favorites", label: t("common.favorites"), icon: Heart });
        primaryLinks.push({ to: "/saved-searches", label: t("savedSearches.nav"), icon: BellRing });
      }
      if (role === "landlord") {
        primaryLinks.push({ to: "/landlord", label: t("common.myListings", "Moje nekretnine"), icon: LayoutDashboard });
        primaryLinks.push({ to: "/landlord/map", label: t("common.myMap", "Moja karta"), icon: MapIcon });
        primaryLinks.push({ to: "/tax-calculator", label: t("common.rentalManagement", "Upravljanje najmom"), icon: Calculator });
        primaryLinks.push({ to: "/landlord/verification", label: t("verification.nav"), icon: ShieldCheck });
      }
      if (role === "admin") {
        primaryLinks.push({ to: "/admin", label: t("common.admin", "Admin"), icon: LayoutDashboard });
      }
      primaryLinks.push({ to: "/roommates", label: t("common.roommates", "Cimeri"), icon: Users });
      if (role === "tenant") {
        primaryLinks.push({ to: "/passport", label: t("common.passport", "Putovnica"), icon: Shield });
      }
      primaryLinks.push({ to: "/inbox", label: t("common.messages"), icon: MessageSquare });
    }
    if (!user || role === "landlord" || role === "admin") {
      primaryLinks.push({ to: "/pricing", label: t("common.pricing"), icon: Sparkles });
    }
  }

  return (
    <header className="sticky top-0 z-[1100] w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container flex h-16 items-center gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground shadow-soft">
            <Home className="h-5 w-5 text-background" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Roof<span className="text-accent">y</span>
          </span>
        </Link>

        {/* Desktop primary nav */}
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {primaryLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls} end={l.to === "/"}>
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden gap-1.5 px-2.5 sm:inline-flex">
                <Globe className="h-4 w-4" />
                <span className="font-medium uppercase">{i18n.language === "en" ? "EN" : "HR"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[1200]">
              <DropdownMenuItem onClick={() => changeLang("hr")}>Hrvatski</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLang("en")}>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <NotificationBell />

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-border transition hover:ring-foreground/40">
                    <Avatar className="h-9 w-9">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
                      <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                        {initials(fullName ?? user.user_metadata?.full_name ?? user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[1200] w-56">
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="inline-flex items-center gap-1 truncate text-sm font-semibold">
                      {user.user_metadata?.full_name ?? user.email}
                      {isVerified && (
                        <BadgeCheck
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-label={t("verification.verifiedBadge", "Verificiran")}
                        />
                      )}
                    </span>
                    {role && (
                      <span className="text-xs font-normal capitalize text-muted-foreground">
                        {t(`auth.role${role.charAt(0).toUpperCase() + role.slice(1)}`, role)}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {role === "tenant" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/favorites"><Heart className="h-4 w-4" />{t("common.favorites")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/saved-searches"><BellRing className="h-4 w-4" />{t("savedSearches.nav")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/pricing"><Sparkles className="h-4 w-4" />{t("common.becomeLandlord", "Postani najmodavac")}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {role === "landlord" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/landlord"><LayoutDashboard className="h-4 w-4" />{t("common.myListings", "Moje nekretnine")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/landlord/map"><MapIcon className="h-4 w-4" />{t("common.myMap", "Moja karta")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/tax-calculator"><Calculator className="h-4 w-4" />{t("common.rentalManagement", "Upravljanje najmom")}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/inbox"><MessageSquare className="h-4 w-4" />{t("common.messages")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account"><UserIcon className="h-4 w-4" />{t("account.title", "Moj račun")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/security"><ShieldCheck className="h-4 w-4" />{t("security.nav", "Sigurnost")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />{t("common.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth/login">{t("common.login")}</Link>
              </Button>
              <Button size="sm" className="rounded-full" asChild>
                <Link to="/auth/register">{t("common.register")}</Link>
              </Button>
            </div>
          )}

          {/* Mobile burger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("common.menu", "Menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[340px]">
              <SheetHeader>
                <SheetTitle className="text-left">
                  Roof<span className="text-accent">y</span>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-1">
                {primaryLinks.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )
                    }
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </NavLink>
                ))}
              </div>

              {!user && (
                <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/auth/login"><UserIcon className="h-4 w-4" />{t("common.login")}</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/auth/register">{t("common.register")}</Link>
                  </Button>
                </div>
              )}

              <div className="mt-6 border-t border-border pt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("common.language")}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={i18n.language === "hr" ? "default" : "outline"}
                    onClick={() => changeLang("hr")}
                    className="flex-1"
                  >
                    Hrvatski
                  </Button>
                  <Button
                    size="sm"
                    variant={i18n.language === "en" ? "default" : "outline"}
                    onClick={() => changeLang("en")}
                    className="flex-1"
                  >
                    English
                  </Button>
                </div>
              </div>

              {user && (
                <div className="mt-6 border-t border-border pt-6">
                  <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />{t("common.logout")}
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
