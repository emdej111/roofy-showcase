import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Download, Eye, EyeOff } from "lucide-react";

type Tpl = {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_type: string;
  file_size: number | null;
  is_active: boolean;
  created_at: string;
};

const fmtSize = (b?: number | null) =>
  !b ? "—" : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

export default function AdminDocuments() {
  const { user } = useAuth();
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contract_templates").select("*").order("created_at", { ascending: false });
    setItems((data as Tpl[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return toast.error("Odaberite datoteku");
    if (!name.trim()) return toast.error("Unesite naziv predloška");
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) return toast.error("Dozvoljeni formati: PDF, DOC, DOCX");
    if (file.size > 20 * 1024 * 1024) return toast.error("Maksimalna veličina 20MB");

    setUploading(true);
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("contract-templates").upload(path, file, { contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }

    const { error: dbErr } = await supabase.from("contract_templates").insert({
      name: name.trim(),
      description: description.trim() || null,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user?.id,
    });
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);

    toast.success("Predložak učitan");
    setName(""); setDescription(""); setFile(null);
    (document.getElementById("file-input") as HTMLInputElement).value = "";
    load();
  };

  const download = async (t: Tpl) => {
    const { data, error } = await supabase.storage.from("contract-templates").createSignedUrl(t.file_path, 300);
    if (error || !data) return toast.error(error?.message || "Greška");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const toggle = async (t: Tpl) => {
    const { error } = await supabase.from("contract_templates").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (t: Tpl) => {
    if (!confirm(`Obrisati "${t.name}"?`)) return;
    await supabase.storage.from("contract-templates").remove([t.file_path]);
    const { error } = await supabase.from("contract_templates").delete().eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success("Obrisano"); load(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Admin — Predlošci ugovora" description="Upravljanje predlošcima ugovora o najmu" />
      <Navbar />
      <main className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dokument Manager</h1>
            <p className="text-sm text-muted-foreground">Predlošci ugovora o najmu (PDF / DOC / DOCX)</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Učitaj novi predložak</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Naziv</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Standardni ugovor o najmu" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file-input">Datoteka (PDF / DOC / DOCX, max 20MB)</Label>
                <Input id="file-input" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Opis (opcionalno)</Label>
              <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
            </div>
            <Button onClick={upload} disabled={uploading}>
              <Upload className="h-4 w-4" />{uploading ? "Učitavanje…" : "Učitaj"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Postojeći predlošci</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Učitavanje…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema predložaka.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{t.name}</p>
                        <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Aktivan" : "Sakriven"}</Badge>
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                      <p className="text-xs text-muted-foreground">{fmtSize(t.file_size)} · {new Date(t.created_at).toLocaleDateString("hr-HR")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => download(t)}><Download className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => toggle(t)}>
                        {t.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
