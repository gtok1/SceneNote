ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_status_flags_known;

ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_status_flags_known
  CHECK (
    status_flags <@ ARRAY[
      'wishlist'::watch_status,
      'watching'::watch_status,
      'completed'::watch_status,
      'recommended'::watch_status,
      'not_recommended'::watch_status,
      'dropped'::watch_status
    ]
  );

COMMENT ON COLUMN user_library_items.status_flags IS
  'User-selected watch status toggles. Display order is fixed in the client as wishlist, watching, completed, recommended, not_recommended. Dropped is deprecated and deletion is handled by removing the library item.';
