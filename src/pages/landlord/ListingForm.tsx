import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { PhotoManager, type ExistingPhoto } from "@/components/PhotoManager";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PinPickerMap } from "@/components/map/PinPickerMap";
import { PlaceAutocomplete, type PlacePick } from "@/components/landlord/PlaceAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Currency = Database["public"]["Enums"]["currency_type"];
type Heating = Database["public"]["Enums"]["heating_type"];
type Furnished = Database["public"]["Enums"]["furnished_type"];
type Parking = Database["public"]["Enums"]["parking_type"];
type Pets = Database["public"]["Enums"]["pets_policy"];
type Condition = Database["public"]["Enums"]["condition_type"];

const schema = z.object({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().max(3000).optional(),
  city: z.string().min(1),
  address: z.string().trim().min(3).max(200),
  postal_code: z.string().trim().regex(/^\d{4,6}$/, "Neispravan poštanski broj"),
  price: z.number().min(50).max(20000),
  size_m2: z.number().min(5).max(2000),
  rooms: z.number().min(0.5).max(20),
});

const PROPERTY_TYPES = [
  "house_yard",
  "apt_in_house",
  "apt_in_building",
  "studio",
  "room",
  "other",
] as const;
type PropertyType = (typeof PROPERTY_TYPES)[number];

const PROPERTY_TYPE_KEY: Record<PropertyType, string> = {
  house_yard: "HouseYard",
  apt_in_house: "AptInHouse",
  apt_in_building: "AptInBuilding",
  studio: "Studio",
  room: "Room",
  other: "Other",
};

const TENANT_SEGMENTS = [
  "students",
  "families",
  "professionals",
  "nomads",
  "seniors",
  "pet_owners",
] as const;
type TenantSegment = (typeof TENANT_SEGMENTS)[number];

const SEGMENT_LABEL: Record<TenantSegment, string> = {
  students: "Studenti",
  families: "Obitelji",
  professionals: "Zaposleni",
  nomads: "Digitalni nomadi",
  seniors: "Umirovljenici",
  pet_owners: "Vlasnici ljubimaca",
};

const initial = {
  title: "",
  description: "",
  city: "",
  address: "",
  postal_code: "",
  price: "",
  currency: "EUR" as Currency,
  size_m2: "",
  rooms: "",
  floor: "",
  total_floors: "",
  available_from: "",
  property_type: "" as PropertyType | "",
  utilities_electricity: false,
  utilities_water: false,
  utilities_gas: false,
  utilities_internet: false,
  heating: "" as Heating | "",
  furnished: "" as Furnished | "",
  appliance_washer: false,
  appliance_dishwasher: false,
  appliance_dryer: false,
  appliance_fridge: false,
  appliance_oven: false,
  appliance_microwave: false,
  parking: "" as Parking | "",
  pets: "" as Pets | "",
  elevator: false,
  balcony: false,
  storage_room: false,
  internet: false,
  air_conditioning: false,
  condition: "" as Condition | "",
  min_rental_months: "",
  notes: "",
  suitable_for: [] as TenantSegment[],
};

export default function ListingForm() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data } = await supabase
        .from("listings")
        .select("*, listing_photos(id,url,display_order)")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        setForm({
          title: data.title,
          description: data.description ?? "",
          city: data.city,
          address: data.address,
          postal_code: (data as any).postal_code ?? "",
          price: String(data.price),
          currency: data.currency,
          size_m2: String(data.size_m2),
          rooms: String(data.rooms),
          floor: data.floor?.toString() ?? "",
          total_floors: data.total_floors?.toString() ?? "",
          available_from: data.available_from ?? "",
          property_type: ((data as { property_type?: PropertyType | null }).property_type ?? "") as PropertyType | "",
          utilities_electricity: data.utilities_electricity,
          utilities_water: data.utilities_water,
          utilities_gas: data.utilities_gas,
          utilities_internet: data.utilities_internet,
          heating: data.heating ?? "",
          furnished: data.furnished ?? "",
          appliance_washer: data.appliance_washer,
          appliance_dishwasher: data.appliance_dishwasher,
          appliance_dryer: data.appliance_dryer,
          appliance_fridge: data.appliance_fridge,
          appliance_oven: data.appliance_oven,
          appliance_microwave: data.appliance_microwave,
          parking: data.parking ?? "",
          pets: data.pets ?? "",
          elevator: data.elevator ?? false,
          balcony: data.balcony ?? false,
          storage_room: data.storage_room ?? false,
          internet: data.internet ?? false,
          air_conditioning: data.air_conditioning ?? false,
          condition: data.condition ?? "",
          min_rental_months: data.min_rental_months?.toString() ?? "",
          notes: data.notes ?? "",
          suitable_for: (((data as { suitable_for?: TenantSegment[] | null }).suitable_for) ?? []) as TenantSegment[],
        });
        setPin({ lat: data.latitude, lng: data.longitude });
        setExistingPhotos(
          [...(data.listing_photos ?? [])]
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            .map((p) => ({ id: p.id, url: p.url })),
        );
      }
      setBootLoading(false);
    })();
  }, [id, isEdit]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Auto-place pin from explicit autocomplete selection.
  // We still allow the user to drag the pin to fine-tune.
  const pinManuallyMovedRef = useRef(false);
  const handlePinChange = (next: { lat: number; lng: number } | null) => {
    pinManuallyMovedRef.current = true;
    setPin(next);
  };

  const handleCityPick = async (place: PlacePick) => {
    const cityName = place.city || place.short_name;
    set("city", cityName);
    pinManuallyMovedRef.current = false;
    setPin({ lat: place.lat, lng: place.lng });

    if (place.postcode) {
      set("postal_code", place.postcode);
    } else {
      // Fallback: reverse-geocode to fetch postal code for the picked city
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${place.lat}&lon=${place.lng}&accept-language=hr&zoom=10`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        const data = await res.json();
        const pc = data?.address?.postcode;
        if (pc) set("postal_code", String(pc));
      } catch {
        // ignore
      }
    }
  };

  const handleAddressPick = (place: PlacePick) => {
    set("address", place.short_name);
    if (place.postcode) set("postal_code", place.postcode);
    if (place.city && !form.city) set("city", place.city);
    pinManuallyMovedRef.current = false;
    setPin({ lat: place.lat, lng: place.lng });
  };

  // Debounced auto-geocode while user types address (in case they don't pick a suggestion)
  useEffect(() => {
    if (pinManuallyMovedRef.current) return;
    const address = form.address.trim();
    const city = form.city.trim();
    if (address.length < 3 || !city) return;

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const q = encodeURIComponent(`${address}, ${city}, Hrvatska`);
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=hr&accept-language=hr&q=${q}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        const data = await res.json();
        const first = Array.isArray(data) && data[0];
        if (first && first.lat && first.lon) {
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            setPin({ lat, lng });
            const pc = first.address?.postcode;
            if (pc && !form.postal_code) set("postal_code", String(pc));
          }
        }
      } catch {
        // ignore
      }
    }, 700);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.city]);





  const removeExistingPhoto = async (photo: ExistingPhoto) => {
    // Delete DB row first
    const { error } = await supabase.from("listing_photos").delete().eq("id", photo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Best-effort delete from storage (extract path after /listing-photos/)
    try {
      const marker = "/listing-photos/";
      const idx = photo.url.indexOf(marker);
      if (idx >= 0) {
        const path = decodeURIComponent(photo.url.slice(idx + marker.length).split("?")[0]);
        await supabase.storage.from("listing-photos").remove([path]);
      }
    } catch {
      // ignore — DB row is gone, storage cleanup is best-effort
    }
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const totalPhotos = existingPhotos.length + newPhotos.length;
    if (totalPhotos < 3) {
      toast.error(t("listing.uploadPhotos"));
      return;
    }
    if (!pin) {
      toast.error(t("listing.pinHint"));
      return;
    }

    const parsed = schema.safeParse({
      title: form.title,
      description: form.description || undefined,
      city: form.city,
      address: form.address,
      postal_code: form.postal_code,
      price: Number(form.price),
      size_m2: Number(form.size_m2),
      rooms: Number(form.rooms),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        landlord_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        city: form.city,
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        latitude: pin.lat,
        longitude: pin.lng,
        price: Number(form.price),
        currency: form.currency,
        size_m2: Number(form.size_m2),
        rooms: Number(form.rooms),
        floor: form.floor ? Number(form.floor) : null,
        total_floors: form.total_floors ? Number(form.total_floors) : null,
        available_from: form.available_from || null,
        property_type: form.property_type || null,
        utilities_electricity: form.utilities_electricity,
        utilities_water: form.utilities_water,
        utilities_gas: form.utilities_gas,
        utilities_internet: form.utilities_internet,
        heating: form.heating || null,
        furnished: form.furnished || null,
        appliance_washer: form.appliance_washer,
        appliance_dishwasher: form.appliance_dishwasher,
        appliance_dryer: form.appliance_dryer,
        appliance_fridge: form.appliance_fridge,
        appliance_oven: form.appliance_oven,
        appliance_microwave: form.appliance_microwave,
        parking: form.parking || null,
        pets: form.pets || null,
        elevator: form.elevator,
        balcony: form.balcony,
        storage_room: form.storage_room,
        internet: form.internet,
        air_conditioning: form.air_conditioning,
        condition: form.condition || null,
        min_rental_months: form.min_rental_months ? Number(form.min_rental_months) : null,
        notes: form.notes.trim() || null,
        suitable_for: form.suitable_for,
      };

      let listingId: string;
      if (isEdit && id) {
        const { error } = await supabase.from("listings").update(payload).eq("id", id);
        if (error) throw error;
        listingId = id;
      } else {
        const { data, error } = await supabase.from("listings").insert(payload).select().single();
        if (error) throw error;
        listingId = data.id;
      }

      // Persist new display_order for existing photos
      for (let i = 0; i < existingPhotos.length; i++) {
        await supabase
          .from("listing_photos")
          .update({ display_order: i })
          .eq("id", existingPhotos[i].id);
      }

      // Upload new photos
      for (let i = 0; i < newPhotos.length; i++) {
        const file = newPhotos[i];
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${listingId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("listing-photos")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("listing-photos").getPublicUrl(path);
        await supabase.from("listing_photos").insert({
          listing_id: listingId,
          url: pub.publicUrl,
          display_order: existingPhotos.length + i,
        });
      }

      toast.success(
        isEdit
          ? t("listing.updateSuccess")
          : t("listing.submittedForReview", {
              defaultValue:
                "Vaš oglas je zaprimljen i bit će vidljiv nakon administrativne provjere (obično unutar 1h).",
            }),
      );
      navigate(isEdit ? "/landlord" : `/landlord?new=${listingId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      if (msg.includes("LISTING_QUOTA_EXCEEDED")) {
        toast.error(t("pricing.quotaExceeded"), {
          action: { label: t("pricing.upgrade"), onClick: () => navigate("/pricing") },
        });
      } else if (msg.includes("DUPLICATE_LISTING")) {
        const m = msg.match(/DUPLICATE_LISTING:(\d{4}-\d{2}-\d{2})/);
        const until = m?.[1] ?? "";
        toast.error(
          `Oglas za ovu nekretninu već postoji${until ? `. Aktivan do ${until}.` : "."}`,
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (bootLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container max-w-4xl py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/landlord")} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Button>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* BASIC */}
          <Section title={t("listing.title")}>
            <Field label={t("listing.title")}>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={140} />
            </Field>
            <Field label={t("listing.description")}>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                maxLength={3000}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("listing.city")}>
                <PlaceAutocomplete
                  value={form.city}
                  onTextChange={(v) => set("city", v)}
                  onSelect={handleCityPick}
                  buildQuery={(text) => `${text}, Hrvatska`}
                  filter={(r) =>
                    ["city", "town", "village", "municipality", "hamlet", "suburb", "city_district"].includes(
                      r.addresstype ?? "",
                    ) || r.category === "place" || r.class === "place"
                  }
                  placeholder={t("listing.city")}
                  required
                />
              </Field>
              <Field label={t("listing.address")}>
                <PlaceAutocomplete
                  value={form.address}
                  onTextChange={(v) => set("address", v)}
                  onSelect={handleAddressPick}
                  buildQuery={(text) => (form.city ? `${text}, ${form.city}` : null)}
                  placeholder={form.city ? t("listing.address") : t("listing.city")}
                  required
                  resetSignal={form.city}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("listing.postalCode", { defaultValue: "Poštanski broj" })}>
                <Input
                  value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="10000"
                  required
                  inputMode="numeric"
                />
              </Field>
            </div>
          </Section>

          {/* PRICE & SIZE */}
          <Section title={`${t("listing.price")} & ${t("listing.size")}`}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("listing.price")}>
                <Input type="number" min="50" value={form.price} onChange={(e) => set("price", e.target.value)} required />
              </Field>
              <Field label={t("listing.currency")}>
                <Select value={form.currency} onValueChange={(v) => set("currency", v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="HRK">HRK (kn)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.size")}>
                <Input type="number" min="5" value={form.size_m2} onChange={(e) => set("size_m2", e.target.value)} required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("listing.rooms")}>
                <Input type="number" step="0.5" min="0.5" value={form.rooms} onChange={(e) => set("rooms", e.target.value)} required />
              </Field>
              <Field label={t("listing.floor")}>
                <Input type="number" value={form.floor} onChange={(e) => set("floor", e.target.value)} />
              </Field>
              <Field label={t("listing.totalFloors")}>
                <Input type="number" value={form.total_floors} onChange={(e) => set("total_floors", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("listing.propertyType")}>
                <Select value={form.property_type} onValueChange={(v) => set("property_type", v as PropertyType)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {t(`listing.propertyType${PROPERTY_TYPE_KEY[pt]}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.availableFrom")}>
                <Input type="date" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* LOCATION */}
          <Section title={t("listing.pinLocation")}>
            <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t("listing.pinHint")}</p>
            <PinPickerMap
              value={pin}
              onChange={handlePinChange}
              defaultCenter={[45.815, 15.9819]}
            />
          </Section>

          {/* PHOTOS */}
          <Section title={t("listing.photos")}>
            <PhotoManager
              existing={existingPhotos}
              onExistingChange={setExistingPhotos}
              onRemoveExisting={removeExistingPhoto}
              newFiles={newPhotos}
              onNewFilesChange={setNewPhotos}
            />
          </Section>

          {/* UTILITIES & FEATURES */}
          <Section title={t("listing.utilities")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Toggle k="utilities_electricity" label={t("listing.electricity")} form={form} set={set} />
              <Toggle k="utilities_water" label={t("listing.water")} form={form} set={set} />
              <Toggle k="utilities_gas" label={t("listing.gas")} form={form} set={set} />
              <Toggle k="utilities_internet" label={t("listing.internet")} form={form} set={set} />
            </div>
          </Section>

          <Section title={t("listing.appliances")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Toggle k="appliance_washer" label={t("listing.washer")} form={form} set={set} />
              <Toggle k="appliance_dishwasher" label={t("listing.dishwasher")} form={form} set={set} />
              <Toggle k="appliance_dryer" label={t("listing.dryer")} form={form} set={set} />
              <Toggle k="appliance_fridge" label={t("listing.fridge")} form={form} set={set} />
              <Toggle k="appliance_oven" label={t("listing.oven")} form={form} set={set} />
              <Toggle k="appliance_microwave" label={t("listing.microwave")} form={form} set={set} />
            </div>
          </Section>

          <Section title={t("listing.notes")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("listing.heating")}>
                <Select value={form.heating} onValueChange={(v) => set("heating", v as Heating)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="central">{t("listing.heatingCentral")}</SelectItem>
                    <SelectItem value="gas">{t("listing.heatingGas")}</SelectItem>
                    <SelectItem value="electric">{t("listing.heatingElectric")}</SelectItem>
                    <SelectItem value="heat_pump">{t("listing.heatingHeatPump")}</SelectItem>
                    <SelectItem value="underfloor">{t("listing.heatingUnderfloor")}</SelectItem>
                    <SelectItem value="none">{t("listing.heatingNone")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.furnished")}>
                <Select value={form.furnished} onValueChange={(v) => set("furnished", v as Furnished)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">{t("listing.furnishedFull")}</SelectItem>
                    <SelectItem value="partial">{t("listing.furnishedPartial")}</SelectItem>
                    <SelectItem value="none">{t("listing.furnishedNone")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.parking")}>
                <Select value={form.parking} onValueChange={(v) => set("parking", v as Parking)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("listing.parkingNone")}</SelectItem>
                    <SelectItem value="street">{t("listing.parkingStreet")}</SelectItem>
                    <SelectItem value="garage">{t("listing.parkingGarage")}</SelectItem>
                    <SelectItem value="private">{t("listing.parkingPrivate")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.pets")}>
                <Select value={form.pets} onValueChange={(v) => set("pets", v as Pets)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">{t("listing.petsYes")}</SelectItem>
                    <SelectItem value="no">{t("listing.petsNo")}</SelectItem>
                    <SelectItem value="negotiable">{t("listing.petsNegotiable")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.condition")}>
                <Select value={form.condition} onValueChange={(v) => set("condition", v as Condition)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t("listing.conditionNew")}</SelectItem>
                    <SelectItem value="renovated">{t("listing.conditionRenovated")}</SelectItem>
                    <SelectItem value="good">{t("listing.conditionGood")}</SelectItem>
                    <SelectItem value="needs_renovation">{t("listing.conditionNeedsRenovation")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("listing.minRental")}>
                <Select value={form.min_rental_months} onValueChange={(v) => set("min_rental_months", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 {t("listing.month")}</SelectItem>
                    <SelectItem value="3">3 {t("listing.months")}</SelectItem>
                    <SelectItem value="6">6 {t("listing.months")}</SelectItem>
                    <SelectItem value="12">1 {t("listing.year")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Toggle k="elevator" label={t("listing.elevator")} form={form} set={set} />
              <Toggle k="balcony" label={t("listing.balcony")} form={form} set={set} />
              <Toggle k="storage_room" label={t("listing.storageRoom")} form={form} set={set} />
              <Toggle k="internet" label={t("listing.internet")} form={form} set={set} />
              <Toggle k="air_conditioning" label={t("listing.airConditioning")} form={form} set={set} />
            </div>
            <div className="mt-4">
              <Field label={t("listing.notes")}>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={2000} />
              </Field>
            </div>
          </Section>

          {/* SUITABLE FOR (SEGMENTATION) */}
          <Section title="Prikladno za (neobavezno)">
            <p className="-mt-2 mb-3 text-sm text-muted-foreground">
              Označite ciljne skupine kojima Vaš stan najbolje odgovara. Pomaže korisnicima brže pronaći Vaš oglas.
              Ako ništa ne odaberete, oglas se prikazuje svima.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TENANT_SEGMENTS.map((seg) => {
                const active = form.suitable_for.includes(seg);
                return (
                  <button
                    key={seg}
                    type="button"
                    onClick={() =>
                      set(
                        "suitable_for",
                        active
                          ? form.suitable_for.filter((s) => s !== seg)
                          : [...form.suitable_for, seg],
                      )
                    }
                    className={
                      "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                      (active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-accent")
                    }
                  >
                    {SEGMENT_LABEL[seg]}
                  </button>
                );
              })}
            </div>
          </Section>



          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/landlord")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t("listing.updateListing") : t("listing.createListing")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle<F extends Record<string, any>>({
  k, label, form, set,
}: {
  k: keyof F;
  label: string;
  form: F;
  set: (k: keyof F, v: any) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
      <span>{label}</span>
      <Switch checked={!!form[k]} onCheckedChange={(v) => set(k, v as any)} />
    </label>
  );
}
