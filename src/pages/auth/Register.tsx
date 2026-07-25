import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Loader2, KeyRound, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterHero } from "@/components/auth/RegisterHero";
import { toast } from "sonner";
import type { AppRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(6).max(20),
});

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roleParam = params.get("role") as AppRole | null;
  const lockedRole = roleParam === "tenant" || roleParam === "landlord";
  const initialRole: AppRole = lockedRole ? (roleParam as AppRole) : "tenant";

  const [role, setRole] = useState<AppRole>(initialRole);
  const [landlordType, setLandlordType] = useState<"private" | "agency">("private");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
          role,
          ...(role === "landlord" ? { landlord_type: landlordType } : {}),
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.registerSuccess"));
    // Svi (i najmoprimci i iznajmljivači) idu na verifikaciju identiteta.
    // Iznajmljivači će nakon odobrene verifikacije biti preusmjereni na pricing.
    navigate("/verify");
  };


  const handleGoogle = async () => {
    localStorage.setItem("pendingRole", role);
    if (role === "landlord") localStorage.setItem("pendingLandlordType", landlordType);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate("/verify");
  };

  return (
    <div className="min-h-screen bg-background">
      <RegisterHero
        title={t("auth.heroTitle")}
        subtitle={t("auth.heroSubtitle")}
      />
      <main className="mx-auto -mt-10 w-full max-w-md px-5 pb-12 sm:px-6">
      {/* Brand logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
            N
          </span>
          <span className="text-xl font-bold tracking-tight">NajamHR</span>
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          {t("auth.registerTitle")}
        </h1>
      </div>

      {/* Role segmented control — hidden when role is forced via URL */}
      {!lockedRole && (
        <div className="mt-8">
          <Label className="mb-2 block text-sm font-medium">{t("auth.selectRole")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["tenant", "landlord"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRole(v)}
                className={cn(
                  "h-12 rounded-xl border text-sm font-semibold transition-all",
                  role === v
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border bg-background text-foreground hover:border-foreground/40",
                )}
              >
                {v === "tenant" ? t("auth.roleTenant") : t("auth.roleLandlord")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Landlord type sub-segmented control */}
      {role === "landlord" && (
        <div className="mt-4">
          <Label className="mb-2 block text-sm font-medium">{t("auth.landlordTypeLabel")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["private", "agency"] as const).map((v) => (
              <div key={v} className="relative">
                <button
                  type="button"
                  onClick={() => setLandlordType(v)}
                  className={cn(
                    "h-11 w-full rounded-xl border text-sm font-semibold transition-all pr-9",
                    landlordType === v
                      ? "border-foreground bg-foreground text-background shadow-sm"
                      : "border-border bg-background text-foreground hover:border-foreground/40",
                  )}
                >
                  {v === "private" ? t("auth.landlordTypePrivate") : t("auth.landlordTypeAgency")}
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="info"
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full transition",
                        landlordType === v ? "text-background/80 hover:text-background" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-72 text-xs">
                    {v === "private"
                      ? t("auth.landlordTypePrivateInfo")
                      : t("auth.landlordTypeAgencyInfo")}
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("auth.landlordTypeHint")}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="fullName">
            {role === "landlord" && landlordType === "agency"
              ? t("auth.agencyContactName")
              : t("auth.fullName")}
          </Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="mt-1.5 h-11 rounded-lg focus-visible:border-foreground focus-visible:ring-0"
            required
          />
        </div>
        <div>
          <Label htmlFor="phone">{t("auth.phone")}</Label>
          <div className="mt-1.5 flex h-11 overflow-hidden rounded-lg border border-input focus-within:border-foreground">
            <span className="flex select-none items-center bg-muted px-3 text-sm font-medium text-muted-foreground">
              +385
            </span>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="91 234 5678"
              className="h-full flex-1 rounded-none border-0 focus-visible:ring-0"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1.5 h-11 rounded-lg focus-visible:border-foreground focus-visible:ring-0"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            className="mt-1.5 h-11 rounded-lg focus-visible:border-foreground focus-visible:ring-0"
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t("auth.passwordMin")}</p>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {t("auth.registerNow")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("auth.or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-full"
        onClick={handleGoogle}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.4 14.66 2.4 12 2.4 6.97 2.4 2.9 6.47 2.9 11.5S6.97 20.6 12 20.6c6.93 0 9.1-4.86 9.1-7.4 0-.5-.05-.88-.13-1.26L12 10.2z"/>
        </svg>
        {t("auth.continueWithGoogle")}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/auth/login" className="font-semibold text-foreground hover:underline">
          {t("auth.loginNow")}
        </Link>
      </p>
      </main>
    </div>
  );
}
