
-- amr_life_intelligence_core (20260708234500) granted `FOR SELECT USING (true)`
-- on all 5 amr_* tables with no role restriction, readable by the public anon
-- key. amr_master_isolate_drug carries isolate-level fields (age_band, gender,
-- specimen_source). Narrow to authenticated-only, matching the pattern already
-- used by sentinel_sites, samples, sequences, variants, and alerts.
DROP POLICY IF EXISTS "Read AMR upload batches" ON public.amr_upload_batches;
DROP POLICY IF EXISTS "Read AMR master" ON public.amr_master_isolate_drug;
DROP POLICY IF EXISTS "Read AMR external" ON public.amr_country_year_external;
DROP POLICY IF EXISTS "Read AMR model outputs" ON public.amr_model_outputs;
DROP POLICY IF EXISTS "Read AMR recommendations" ON public.amr_policy_recommendations;

CREATE POLICY "Read AMR upload batches" ON public.amr_upload_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read AMR master" ON public.amr_master_isolate_drug FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read AMR external" ON public.amr_country_year_external FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read AMR model outputs" ON public.amr_model_outputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read AMR recommendations" ON public.amr_policy_recommendations FOR SELECT TO authenticated USING (true);
