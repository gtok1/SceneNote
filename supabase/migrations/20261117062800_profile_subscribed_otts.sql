-- docs/74: OTT services the account subscribes to. Values are provider group keys
-- (netflix, tving, ...) validated by the app; unknown keys are ignored when read.
-- Existing profiles SELECT/INSERT/UPDATE policies all require auth.uid() = id.
ALTER TABLE public.profiles
  ADD COLUMN subscribed_otts TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD CONSTRAINT profiles_subscribed_otts_limit CHECK (cardinality(subscribed_otts) <= 20);

COMMENT ON COLUMN public.profiles.subscribed_otts IS
  'Subscribed OTT group keys (docs/74). Empty array means not set. Protected by profiles own-user RLS.';
