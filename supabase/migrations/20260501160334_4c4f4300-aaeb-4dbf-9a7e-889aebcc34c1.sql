-- ENUMS
CREATE TYPE public.app_role AS ENUM ('landlord', 'tenant');
CREATE TYPE public.listing_status AS ENUM ('available', 'reserved', 'rented');
CREATE TYPE public.furnished_type AS ENUM ('full', 'partial', 'none');
CREATE TYPE public.heating_type AS ENUM ('central', 'gas', 'electric', 'heat_pump', 'underfloor', 'none');
CREATE TYPE public.parking_type AS ENUM ('none', 'street', 'garage', 'private');
CREATE TYPE public.pets_policy AS ENUM ('yes', 'no', 'negotiable');
CREATE TYPE public.condition_type AS ENUM ('new', 'renovated', 'good', 'needs_renovation');
CREATE TYPE public.currency_type AS ENUM ('EUR', 'HRK');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER ROLES (separate table — security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );

  IF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data ->> 'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LISTINGS
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency public.currency_type NOT NULL DEFAULT 'EUR',
  size_m2 NUMERIC(7,2) NOT NULL,
  rooms NUMERIC(3,1) NOT NULL,
  floor INT,
  total_floors INT,
  available_from DATE,
  status public.listing_status NOT NULL DEFAULT 'available',
  -- utilities
  utilities_electricity BOOLEAN NOT NULL DEFAULT false,
  utilities_water BOOLEAN NOT NULL DEFAULT false,
  utilities_gas BOOLEAN NOT NULL DEFAULT false,
  utilities_internet BOOLEAN NOT NULL DEFAULT false,
  -- features
  heating public.heating_type,
  furnished public.furnished_type,
  appliance_washer BOOLEAN NOT NULL DEFAULT false,
  appliance_dishwasher BOOLEAN NOT NULL DEFAULT false,
  appliance_dryer BOOLEAN NOT NULL DEFAULT false,
  appliance_fridge BOOLEAN NOT NULL DEFAULT false,
  appliance_oven BOOLEAN NOT NULL DEFAULT false,
  appliance_microwave BOOLEAN NOT NULL DEFAULT false,
  parking public.parking_type,
  pets public.pets_policy,
  elevator BOOLEAN,
  balcony BOOLEAN,
  storage_room BOOLEAN,
  internet BOOLEAN,
  air_conditioning BOOLEAN,
  condition public.condition_type,
  min_rental_months INT,
  notes TEXT,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_city_idx ON public.listings(city);
CREATE INDEX listings_status_idx ON public.listings(status);
CREATE INDEX listings_geo_idx ON public.listings(latitude, longitude);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings are viewable by everyone"
  ON public.listings FOR SELECT USING (true);
CREATE POLICY "Landlords can create their own listings"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = landlord_id AND public.has_role(auth.uid(), 'landlord'));
CREATE POLICY "Landlords can update their own listings"
  ON public.listings FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can delete their own listings"
  ON public.listings FOR DELETE USING (auth.uid() = landlord_id);

-- LISTING PHOTOS
CREATE TABLE public.listing_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listing_photos_listing_idx ON public.listing_photos(listing_id);
ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos viewable by everyone"
  ON public.listing_photos FOR SELECT USING (true);
CREATE POLICY "Landlords can manage photos for their own listings"
  ON public.listing_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.landlord_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.landlord_id = auth.uid()));

-- FAVORITES
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, listing_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants view their own favorites"
  ON public.favorites FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Tenants manage their own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);

-- INQUIRIES
CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_landlord_idx ON public.inquiries(landlord_id);
CREATE INDEX inquiries_tenant_idx ON public.inquiries(tenant_id);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants and landlords view their inquiries"
  ON public.inquiries FOR SELECT
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);
CREATE POLICY "Tenants can create inquiries"
  ON public.inquiries FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER listings_touch BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true);

CREATE POLICY "Listing photos publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-photos');
CREATE POLICY "Authenticated users can upload listing photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listing-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'listing-photos' AND owner = auth.uid());
CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'listing-photos' AND owner = auth.uid());