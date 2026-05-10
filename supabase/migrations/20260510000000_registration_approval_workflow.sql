-- Registration approval workflow
-- Adds status tracking, approval audit columns, and sheet row index to registration entries

ALTER TABLE tournament_registration_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sheet_row_index integer;

-- Backfill existing entries as approved so nothing breaks for current users
UPDATE tournament_registration_entries
SET status = 'approved'
WHERE status = 'pending';
