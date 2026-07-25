import type { Database } from "@/integrations/supabase/types";

export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];
export type ListingPhoto = Database["public"]["Tables"]["listing_photos"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Inquiry = Database["public"]["Tables"]["inquiries"]["Row"];

export type ListingWithPhotos = Listing & {
  listing_photos: ListingPhoto[];
};
