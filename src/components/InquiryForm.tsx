import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const inquirySchema = z.object({
  move_in_date: z.string().optional(),
  budget_max: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), { message: "Mora biti broj ≥ 0" }),
  household_size: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(+v) && +v >= 1 && +v <= 20), {
      message: "Između 1 i 20",
    }),
  rental_period_months: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(+v) && +v >= 1 && +v <= 120), {
      message: "Između 1 i 120",
    }),
  pets: z.boolean(),
  employment_status: z.enum([
    "employed", "self_employed", "student", "retired", "unemployed", "other", "",
  ]).optional(),
  message: z.string().trim().max(1000).optional(),
});

export type InquiryPayload = {
  move_in_date: string | null;
  budget_max: number | null;
  household_size: number | null;
  rental_period_months: number | null;
  pets: boolean;
  employment_status: string | null;
  message: string | null;
};

interface Props {
  onSubmit: (payload: InquiryPayload) => Promise<void> | void;
  submitting?: boolean;
  defaultBudget?: number;
  defaultPeriod?: number;
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  employed: "Zaposlen/a",
  self_employed: "Samozaposlen/a",
  student: "Student/ica",
  retired: "Umirovljenik/ica",
  unemployed: "Nezaposlen/a",
  other: "Ostalo",
};

export function InquiryForm({ onSubmit, submitting, defaultBudget, defaultPeriod }: Props) {
  const [moveIn, setMoveIn] = useState("");
  const [budget, setBudget] = useState(defaultBudget ? String(defaultBudget) : "");
  const [household, setHousehold] = useState("1");
  const [period, setPeriod] = useState(defaultPeriod ? String(defaultPeriod) : "12");
  const [pets, setPets] = useState(false);
  const [employment, setEmployment] = useState<string>("");
  const [message, setMessage] = useState("");

  const handle = async () => {
    const parsed = inquirySchema.safeParse({
      move_in_date: moveIn || undefined,
      budget_max: budget || undefined,
      household_size: household || undefined,
      rental_period_months: period || undefined,
      pets,
      employment_status: (employment || "") as InquiryPayload["employment_status"],
      message,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Provjerite unesene podatke");
      return;
    }
    await onSubmit({
      move_in_date: moveIn || null,
      budget_max: budget ? Number(budget) : null,
      household_size: household ? Number(household) : null,
      rental_period_months: period ? Number(period) : null,
      pets,
      employment_status: employment || null,
      message: message.trim() || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="move_in">Datum useljenja</Label>
          <Input
            id="move_in"
            type="date"
            value={moveIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setMoveIn(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="budget">Maks. budžet (€/mj)</Label>
          <Input
            id="budget"
            type="number"
            inputMode="numeric"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="npr. 800"
          />
        </div>
        <div>
          <Label htmlFor="household">Broj osoba</Label>
          <Input
            id="household"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={household}
            onChange={(e) => setHousehold(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="period">Trajanje najma (mj.)</Label>
          <Input
            id="period"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Label>Status zaposlenja</Label>
          <Select value={employment} onValueChange={setEmployment}>
            <SelectTrigger>
              <SelectValue placeholder="Odaberite (opcionalno)" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Checkbox id="pets" checked={pets} onCheckedChange={(v) => setPets(!!v)} />
          <Label htmlFor="pets" className="font-normal">Imam kućnog ljubimca</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="msg">Poruka stanodavcu (opcionalno)</Label>
        <Textarea
          id="msg"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Predstavite se ukratko..."
          maxLength={1000}
        />
      </div>

      <Button onClick={handle} disabled={submitting} className="w-full" size="lg">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Pošalji upit
      </Button>
    </div>
  );
}

export function InquirySummary({
  inquiry,
}: {
  inquiry: {
    move_in_date?: string | null;
    budget_max?: number | string | null;
    household_size?: number | null;
    rental_period_months?: number | null;
    pets?: boolean | null;
    employment_status?: string | null;
  };
}) {
  const items: { label: string; value: string }[] = [];
  if (inquiry.move_in_date) items.push({ label: "Useljenje", value: inquiry.move_in_date });
  if (inquiry.budget_max != null && inquiry.budget_max !== "")
    items.push({ label: "Budžet", value: `€${Number(inquiry.budget_max).toLocaleString("hr-HR")}/mj` });
  if (inquiry.household_size) items.push({ label: "Osoba", value: String(inquiry.household_size) });
  if (inquiry.rental_period_months)
    items.push({ label: "Trajanje", value: `${inquiry.rental_period_months} mj.` });
  if (inquiry.pets != null)
    items.push({ label: "Ljubimci", value: inquiry.pets ? "Da" : "Ne" });
  if (inquiry.employment_status)
    items.push({ label: "Zaposlenje", value: EMPLOYMENT_LABELS[inquiry.employment_status] ?? inquiry.employment_status });

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Detalji upita
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {items.map((it) => (
          <div key={it.label} className="flex justify-between">
            <dt className="text-muted-foreground">{it.label}</dt>
            <dd className="font-medium">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
