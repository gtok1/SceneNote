-- Applied search filters belong to an account. Query text and history stay out of this document.
-- Existing profiles SELECT/INSERT/UPDATE policies all require auth.uid() = id.
ALTER TABLE public.profiles
  ADD COLUMN search_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT profiles_search_filters_object CHECK (jsonb_typeof(search_filters) = 'object');

COMMENT ON COLUMN public.profiles.search_filters IS
  'Versioned applied search filters: mediaTypes, genreFilters, countryFilters, statusFilter, year, sortOrder. Empty arrays mean all. Protected by profiles own-user RLS.';
