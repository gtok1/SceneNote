-- Add a real selectable status for contents the user does not recommend.
-- `dropped` remains only for backward compatibility with older rows.

ALTER TYPE watch_status ADD VALUE IF NOT EXISTS 'not_recommended';
