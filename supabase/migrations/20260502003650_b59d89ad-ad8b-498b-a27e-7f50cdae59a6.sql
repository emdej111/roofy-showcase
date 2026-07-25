
CREATE OR REPLACE FUNCTION public.landlord_response_stats(_landlord_id uuid)
RETURNS TABLE (
  median_hours numeric,
  response_rate numeric,
  sample_size bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH recent AS (
    SELECT i.id, i.created_at, i.landlord_id, i.status
      FROM public.inquiries i
     WHERE i.landlord_id = _landlord_id
       AND i.created_at >= now() - interval '90 days'
  ),
  first_reply AS (
    SELECT r.id AS inquiry_id,
           MIN(m.created_at) AS first_reply_at
      FROM recent r
      LEFT JOIN public.messages m
        ON m.inquiry_id = r.id
       AND m.sender_id = r.landlord_id
     GROUP BY r.id
  ),
  joined AS (
    SELECT r.id,
           r.created_at,
           r.status,
           fr.first_reply_at,
           CASE
             WHEN fr.first_reply_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (fr.first_reply_at - r.created_at)) / 3600.0
             ELSE NULL
           END AS hours_to_reply,
           (fr.first_reply_at IS NOT NULL OR r.status IN ('accepted','declined')) AS responded
      FROM recent r
      LEFT JOIN first_reply fr ON fr.inquiry_id = r.id
  )
  SELECT
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY hours_to_reply) FILTER (WHERE hours_to_reply IS NOT NULL)::numeric, 2) AS median_hours,
    CASE WHEN count(*) = 0 THEN NULL
         ELSE ROUND((count(*) FILTER (WHERE responded))::numeric / count(*)::numeric, 4)
    END AS response_rate,
    count(*)::bigint AS sample_size
  FROM joined;
$$;
