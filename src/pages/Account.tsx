import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Upload, Trash2, User as UserIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_MB = 5;
const ONE_YEAR = 60 * 60 * 24 * 365;

export default function Account() {
  const { t } = useTranslation();
  const { user, avatarUrl, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url, avatar_path")
        .eq("id", user.id)
        .maybeSingle();
      setFullName((data as any)?.full_name ?? "");
      setPhone((data as any)?.phone ?? "");
      setCurrentPath((data as any)?.avatar_path ?? null);
      setPreviewUrl((data as any)?.avatar_url ?? null);
      setLoading(false);
    })();
  }, [user]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("account.errorType", "Please choose an image file."));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(t("account.errorSize", `Max ${MAX_MB}MB.`));
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { data: signed, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, ONE_YEAR);
      if (sErr) throw sErr;

      const url = signed.signedUrl;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url, avatar_path: path } as any)
        .eq("id", user.id);
      if (updErr) throw updErr;

      // Delete old file (best-effort)
      if (currentPath && currentPath !== path) {
        await supabase.storage.from("avatars").remove([currentPath]);
      }

      setCurrentPath(path);
      setPreviewUrl(url);
      await refreshProfile();
      toast.success(t("account.photoUpdated", "Profile photo updated."));
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setUploading(true);
    try {
      if (currentPath) {
        await supabase.storage.from("avatars").remove([currentPath]);
      }
      await supabase
        .from("profiles")
        .update({ avatar_url: null, avatar_path: null } as any)
        .eq("id", user.id);
      setCurrentPath(null);
      setPreviewUrl(null);
      await refreshProfile();
      toast.success(t("account.photoRemoved", "Profile photo removed."));
    } catch (e: any) {
      toast.error(e.message ?? "Remove failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success(t("account.saved", "Saved."));
  };

  const initials = (fullName || user?.email || "U")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background">
      <SEO title={t("account.title", "Moj račun") + " · Roofy"} description="Manage your profile" />
      <Navbar />
      <main className="container max-w-2xl py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("account.title", "Moj račun")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("account.subtitle", "Uredi svoju profilnu fotografiju i osnovne podatke.")}
        </p>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="mt-6 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("account.photoSection", "Profilna fotografija")}
              </h2>
              <div className="mt-4 flex items-center gap-5">
                <Avatar className="h-20 w-20 ring-1 ring-border">
                  {previewUrl ? (
                    <AvatarImage src={previewUrl} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-foreground text-lg font-semibold text-background">
                    {initials || <UserIcon className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {previewUrl
                      ? t("account.changePhoto", "Promijeni fotografiju")
                      : t("account.uploadPhoto", "Učitaj fotografiju")}
                  </Button>
                  {previewUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemove}
                      disabled={uploading}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("account.removePhoto", "Ukloni")}
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("account.photoHint", `JPG, PNG ili WebP. Maks. ${MAX_MB}MB.`)}
              </p>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("account.detailsSection", "Osnovni podaci")}
              </h2>
              <div className="mt-4 grid gap-4">
                <div>
                  <Label htmlFor="fullName">{t("account.fullName", "Ime i prezime")}</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t("account.phone", "Telefon")}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>{t("account.email", "Email")}</Label>
                  <Input value={user?.email ?? ""} disabled className="mt-1.5" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
