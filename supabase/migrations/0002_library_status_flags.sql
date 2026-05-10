-- Allow a library item to carry multiple user-selected status flags while
-- keeping the original `status` column as a backward-compatible primary flag.

ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS status_flags watch_status[] NOT NULL DEFAULT ARRAY['wishlist'::watch_status];

UPDATE user_library_items
SET status_flags = ARRAY[status]
WHERE status_flags IS NULL OR cardinality(status_flags) = 0;

ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_status_flags_known
  CHECK (
    status_flags <@ ARRAY[
      'wishlist'::watch_status,
      'watching'::watch_status,
      'completed'::watch_status,
      'dropped'::watch_status
    ]
  );

COMMENT ON COLUMN user_library_items.status_flags IS
  'User-selected watch status toggles. Display order is fixed in the client as wishlist, watching, completed, dropped. The legacy status column stores the first selected flag for compatibility.';

CREATE INDEX IF NOT EXISTS idx_user_library_items_status_flags
  ON user_library_items USING GIN (status_flags);
