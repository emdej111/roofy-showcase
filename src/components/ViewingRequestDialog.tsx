import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  listingId: string;
  landlordId: string;
  listingTitle: string;
}

export function ViewingRequestDialog({ listingId, landlordId, listingTitle }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dateTime, setDateTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const minLocal = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  const submit = async () => {
    if (!user) { navigate("/auth/login"); return; }
    if (!dateTime) { toast.error("Odaberite datum i vrijeme"); return; }
    const proposed = new Date(dateTime);
    if (proposed.getTime() < Date.now()) { toast.error("Termin mora biti u budućnosti"); return; }
    setBusy(true);
    const { error } = await supabase.from("viewings").insert({
      listing_id: listingId,
      tenant_id: user.id,
      landlord_id: landlordId,
      proposed_at: proposed.toISOString(),
      tenant_note: note.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Zahtjev poslan — čekamo potvrdu najmodavca");
    setOpen(false);
    setDateTime(""); setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="mt-2 w-full" size="lg">
          <CalendarClock className="h-4 w-4" />Zatraži razgledavanje
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Termin razgledavanja</DialogTitle>
          <DialogDescription>{listingTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="viewing-when">Predloženi datum i vrijeme</Label>
            <Input
              id="viewing-when"
              type="datetime-local"
              min={minLocal}
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="viewing-note">Poruka (opcionalno)</Label>
            <Textarea
              id="viewing-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Npr. dolazim s roditeljima…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Odustani</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Pošalji zahtjev
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
