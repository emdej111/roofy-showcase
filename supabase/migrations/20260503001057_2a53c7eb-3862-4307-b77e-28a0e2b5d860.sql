CREATE TABLE public.city_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL UNIQUE,
  income_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  surtax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  lump_sum_deduction_rate NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.city_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tax rates viewable by everyone"
ON public.city_tax_rates FOR SELECT
USING (true);

CREATE POLICY "Admins can insert tax rates"
ON public.city_tax_rates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tax rates"
ON public.city_tax_rates FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tax rates"
ON public.city_tax_rates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_city_tax_rates_updated_at
BEFORE UPDATE ON public.city_tax_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.city_tax_rates (city, income_tax_rate, surtax_rate, lump_sum_deduction_rate) VALUES
  ('Zagreb', 12.00, 18.00, 30.00),
  ('Split', 12.00, 15.00, 30.00),
  ('Rijeka', 12.00, 15.00, 30.00),
  ('Osijek', 12.00, 13.00, 30.00),
  ('Zadar', 12.00, 12.00, 30.00),
  ('Pula', 12.00, 7.50, 30.00),
  ('Dubrovnik', 12.00, 10.00, 30.00),
  ('Slavonski Brod', 12.00, 12.00, 30.00),
  ('Karlovac', 12.00, 12.00, 30.00),
  ('Varaždin', 12.00, 10.00, 30.00),
  ('Šibenik', 12.00, 10.00, 30.00),
  ('Sisak', 12.00, 10.00, 30.00);
