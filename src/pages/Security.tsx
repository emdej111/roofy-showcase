import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Smartphone, KeyRound, Trash2, LogOut, Copy, Check, History } from "lucide-react";
import { toast } from "sonner";
import { logSecurityEvent } from "@/lib/securityLog";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .match(/.{1,4}/g)!
    .join("-")
    .toUpperCase();
}

export default function Security() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  // Audit log za prikaz korisniku — RLS dopušta SELECT samo vlastitih zapisa.
  const [auditEvents, setAuditEvents] = useState<Array<{
    id: string; event_type: string; created_at: string; ip_address: string | null;
  }>>([]);

  const loadFactors = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors([...(data.totp ?? []), ...(data.phone ?? [])] as Factor[]);
    }
    setLoading(false);
  };

  const loadAuditLog = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("security_audit_log" as any)
      .select("id,event_type,created_at,ip_address")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setAuditEvents(data as any);
  };

  useEffect(() => {
    loadFactors();
    loadAuditLog();
  }, [user?.id]);

  const totpFactor = factors.find((f) => f.factor_type === "totp" && f.status === "verified");

  const startEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Roofy ${new Date().toLocaleDateString()}`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const cancelEnroll = async () => {
    if (!enrolling) return;
    await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
    setOtp("");
  };

  const verifyEnroll = async () => {
    if (!enrolling || !user) return;
    setVerifying(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (chalErr) {
      toast.error(chalErr.message);
      setVerifying(false);
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: chal.id,
      code: otp,
    });
    if (verErr) {
      toast.error(verErr.message);
      setVerifying(false);
      return;
    }

    // Generate recovery codes
    const codes = Array.from({ length: 10 }, generateRecoveryCode);
    const hashed = await Promise.all(
      codes.map(async (c) => ({ user_id: user.id, code_hash: await sha256Hex(c) })),
    );
    // wipe previous unused codes
    await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
    await supabase.from("mfa_recovery_codes").insert(hashed);

    setRecoveryCodes(codes);
    setEnrolling(null);
    setOtp("");
    setVerifying(false);
    logSecurityEvent("mfa_enabled");
    toast.success(t("security.enableSuccess", "Dvofaktorska autentikacija je uključena"));
    await loadFactors();
  };

  const disableMfa = async () => {
    if (!totpFactor) return;
    if (!confirm(t("security.disableConfirm", "Sigurni ste da želite isključiti 2FA?"))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (user) {
      await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
    }
    logSecurityEvent("mfa_disabled");
    toast.success(t("security.disabled", "2FA isključen"));
    await loadFactors();
  };

  const regenerateCodes = async () => {
    if (!user) return;
    const codes = Array.from({ length: 10 }, generateRecoveryCode);
    const hashed = await Promise.all(
      codes.map(async (c) => ({ user_id: user.id, code_hash: await sha256Hex(c) })),
    );
    await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
    const { error } = await supabase.from("mfa_recovery_codes").insert(hashed);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRecoveryCodes(codes);
    toast.success(t("security.codesRegenerated", "Novi rezervni kodovi generirani"));
  };

  const copyCodes = async () => {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const signOutEverywhere = async () => {
    if (!confirm(t("security.signOutAllConfirm", "Odjaviti se sa svih uređaja?"))) return;
    // Audit log MORA biti prije signOut-a, dok JWT još vrijedi.
    await logSecurityEvent("logout_all_devices");
    await supabase.auth.signOut({ scope: "global" });
    toast.success(t("security.signedOutAll", "Odjavljeni ste sa svih uređaja"));
    await signOut();
    window.location.href = "/auth/login";
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-10">
      <div className="mb-8 flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("security.title", "Sigurnost računa")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("security.subtitle", "Zaštitite svoj račun dodatnim slojem sigurnosti.")}
          </p>
        </div>
      </div>

      {/* TOTP card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t("security.totpTitle", "Aplikacija za autentikaciju (TOTP)")}
          </CardTitle>
          <CardDescription>
            {t(
              "security.totpDesc",
              "Koristite Google Authenticator, Authy ili 1Password za jednokratne kodove pri prijavi.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpFactor && !enrolling && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>{t("security.enabled", "2FA je aktivan")}</AlertTitle>
              <AlertDescription>
                {t("security.enabledDesc", "Pri svakoj novoj prijavi tražit će se 6-znamenkasti kod.")}
              </AlertDescription>
            </Alert>
          )}

          {!totpFactor && !enrolling && (
            <Button onClick={startEnroll} className="w-full sm:w-auto">
              <Smartphone className="h-4 w-4" />
              {t("security.enableBtn", "Uključi 2FA")}
            </Button>
          )}

          {enrolling && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {t("security.scanQr", "Skenirajte QR kod aplikacijom za autentikaciju:")}
                </p>
                <div
                  className="rounded-md bg-white p-3"
                  dangerouslySetInnerHTML={{ __html: enrolling.qr }}
                />
                <p className="break-all text-center font-mono text-xs text-muted-foreground">
                  {t("security.manualKey", "Ili upišite ručno:")} <strong>{enrolling.secret}</strong>
                </p>
              </div>
              <div>
                <Label htmlFor="otp">{t("security.enterCode", "Unesite 6-znamenkasti kod iz aplikacije")}</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="mt-1.5 font-mono tracking-widest"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={verifyEnroll} disabled={otp.length !== 6 || verifying}>
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t("security.confirm", "Potvrdi i uključi")}
                </Button>
                <Button variant="outline" onClick={cancelEnroll}>
                  {t("common.cancel", "Odustani")}
                </Button>
              </div>
            </div>
          )}

          {totpFactor && (
            <Button variant="outline" onClick={disableMfa}>
              <Trash2 className="h-4 w-4" />
              {t("security.disableBtn", "Isključi 2FA")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recovery codes */}
      {totpFactor && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t("security.recoveryTitle", "Rezervni kodovi")}
            </CardTitle>
            <CardDescription>
              {t(
                "security.recoveryDesc",
                "Ako izgubite pristup aplikaciji za autentikaciju, koristite jedan od ovih jednokratnih kodova.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recoveryCodes ? (
              <>
                <Alert>
                  <AlertTitle>{t("security.saveCodes", "Spremite ove kodove na sigurno!")}</AlertTitle>
                  <AlertDescription>
                    {t(
                      "security.saveCodesDesc",
                      "Ovo je jedini put kad ih možete vidjeti. Svaki kod radi samo jednom.",
                    )}
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-4 font-mono text-sm">
                  {recoveryCodes.map((c) => (
                    <div key={c}>{c}</div>
                  ))}
                </div>
                <Button variant="outline" onClick={copyCodes}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t("common.copied", "Kopirano") : t("common.copy", "Kopiraj sve")}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={regenerateCodes}>
                <KeyRound className="h-4 w-4" />
                {t("security.regenerate", "Generiraj nove kodove")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sessions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            {t("security.sessionsTitle", "Aktivne sesije")}
          </CardTitle>
          <CardDescription>
            {t(
              "security.sessionsDesc",
              "Ako sumnjate da netko ima pristup vašem računu, odjavite se sa svih uređaja.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOutEverywhere}>
            <LogOut className="h-4 w-4" />
            {t("security.signOutAll", "Odjavi me sa svih uređaja")}
          </Button>
        </CardContent>
      </Card>

      {/* Audit log — povijest sigurnosnih događaja na ovom računu */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("security.auditTitle", "Povijest aktivnosti")}
          </CardTitle>
          <CardDescription>
            {t(
              "security.auditDesc",
              "Zadnjih 20 sigurnosnih događaja na vašem računu. Ako vidite nepoznatu aktivnost, odmah promijenite lozinku i odjavite se sa svih uređaja.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("security.auditEmpty", "Još nema zapisanih događaja.")}
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {auditEvents.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">{ev.event_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("hr-HR")}
                      {ev.ip_address && ev.ip_address !== "unknown" && (
                        <span className="ml-2">· IP: {ev.ip_address}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
