-- Pouch v3: task priority/due date + contact/quote types
-- Run in Supabase SQL Editor after v1/v2 migrations.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS priority TEXT;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_priority_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_priority_check
      CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_type_check;

ALTER TABLE public.items
  ADD CONSTRAINT items_type_check
  CHECK (type IN ('note', 'link', 'task', 'expense', 'unsorted', 'contact', 'quote'));

CREATE INDEX IF NOT EXISTS items_user_due_at_idx
  ON public.items (user_id, due_at)
  WHERE due_at IS NOT NULL;
