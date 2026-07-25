-- Contract templates
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates viewable by authenticated"
ON public.contract_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins insert templates"
ON public.contract_templates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update templates"
ON public.contract_templates FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete templates"
ON public.contract_templates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-templates', 'contract-templates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins upload contract templates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contract-templates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update contract templates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'contract-templates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete contract templates"
ON storage.objects FOR DELETE
USING (bucket_id = 'contract-templates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read contract templates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contract-templates');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.city_tax_rates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_templates;

-- Seed more Croatian cities (skip duplicates)
INSERT INTO public.city_tax_rates (city, income_tax_rate, surtax_rate, lump_sum_deduction_rate) VALUES
  ('Velika Gorica', 12.00, 12.00, 30.00),
  ('Vinkovci', 12.00, 10.00, 30.00),
  ('Vukovar', 12.00, 10.00, 30.00),
  ('Bjelovar', 12.00, 6.00, 30.00),
  ('Koprivnica', 12.00, 8.00, 30.00),
  ('Kaštela', 12.00, 5.00, 30.00),
  ('Solin', 12.00, 10.00, 30.00),
  ('Samobor', 12.00, 12.00, 30.00),
  ('Sesvete', 12.00, 18.00, 30.00),
  ('Čakovec', 12.00, 9.00, 30.00),
  ('Križevci', 12.00, 6.00, 30.00),
  ('Đakovo', 12.00, 10.00, 30.00),
  ('Gospić', 12.00, 6.00, 30.00),
  ('Knin', 12.00, 10.00, 30.00),
  ('Krapina', 12.00, 5.00, 30.00),
  ('Makarska', 12.00, 10.00, 30.00),
  ('Metković', 12.00, 6.00, 30.00),
  ('Nova Gradiška', 12.00, 10.00, 30.00),
  ('Ogulin', 12.00, 6.00, 30.00),
  ('Petrinja', 12.00, 12.00, 30.00),
  ('Poreč', 12.00, 6.00, 30.00),
  ('Požega', 12.00, 10.00, 30.00),
  ('Rovinj', 12.00, 6.00, 30.00),
  ('Senj', 12.00, 6.00, 30.00),
  ('Slatina', 12.00, 6.00, 30.00),
  ('Trogir', 12.00, 7.50, 30.00),
  ('Umag', 12.00, 6.00, 30.00),
  ('Virovitica', 12.00, 8.00, 30.00),
  ('Zaprešić', 12.00, 12.00, 30.00),
  ('Pazin', 12.00, 5.00, 30.00),
  ('Ivanić-Grad', 12.00, 8.00, 30.00),
  ('Daruvar', 12.00, 5.00, 30.00)
ON CONFLICT (city) DO NOTHING;
