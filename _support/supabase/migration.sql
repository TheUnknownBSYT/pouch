-- Pouch: items table + RLS policies
-- Paste this into the Supabase SQL Editor and run once on a fresh project.

CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('note', 'link', 'task', 'expense', 'unsorted', 'contact', 'quote')),
  amount NUMERIC NULL,
  source TEXT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  account TEXT NULL CHECK (account IS NULL OR account IN ('cash', 'gpay')),
  direction TEXT NULL CHECK (direction IS NULL OR direction IN ('in', 'out')),
  priority TEXT NULL CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
  due_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX items_user_id_created_at_idx
  ON public.items (user_id, created_at DESC);

CREATE INDEX items_user_occurred_at_idx
  ON public.items (user_id, occurred_at DESC);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own items"
  ON public.items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items"
  ON public.items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON public.items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON public.items
  FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
