-- Pouch v2 migration (run if you already created the items table from v1)
-- Adds transaction date, account, and direction fields.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS account TEXT;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS direction TEXT;

UPDATE public.items
SET occurred_at = created_at
WHERE occurred_at IS NULL;

ALTER TABLE public.items
  ALTER COLUMN occurred_at SET DEFAULT now();

ALTER TABLE public.items
  ALTER COLUMN occurred_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_account_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_account_check
      CHECK (account IS NULL OR account IN ('cash', 'gpay'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_direction_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_direction_check
      CHECK (direction IS NULL OR direction IN ('in', 'out'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS items_user_occurred_at_idx
  ON public.items (user_id, occurred_at DESC);
