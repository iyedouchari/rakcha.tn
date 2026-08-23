-- ==============================================================================
-- RAKCHA APPLICATION - USER BLOCKING & SAFETY MIGRATION SCHEMA
-- ==============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run All

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. BLOCKED USERS TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Index for high-performance relationship queries
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- ── 2. ROW-LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view blocks they are part of" ON public.blocked_users;
CREATE POLICY "Users can view blocks they are part of"
  ON public.blocked_users
  FOR SELECT
  USING (
    auth.uid() = blocker_id OR auth.uid() = blocked_id
  );

DROP POLICY IF EXISTS "Users can block other users" ON public.blocked_users;
CREATE POLICY "Users can block other users"
  ON public.blocked_users
  FOR INSERT
  WITH CHECK (
    auth.uid() = blocker_id AND blocker_id != blocked_id
  );

DROP POLICY IF EXISTS "Users can unblock users they blocked" ON public.blocked_users;
CREATE POLICY "Users can unblock users they blocked"
  ON public.blocked_users
  FOR DELETE
  USING (
    auth.uid() = blocker_id
  );

-- ── 3. AUTO-UNFRIEND TRIGGER ON BLOCK ─────────────────────────────────────────
-- When User A blocks User B, automatically remove any existing friendships
CREATE OR REPLACE FUNCTION public.handle_auto_unfriend_on_block()
RETURNS trigger AS $$
BEGIN
  -- Delete bidirectional friend requests and friendships
  DELETE FROM public.friend_requests
  WHERE (sender_id = NEW.blocker_id AND receiver_id = NEW.blocked_id)
     OR (sender_id = NEW.blocked_id AND receiver_id = NEW.blocker_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_unfriend_on_block ON public.blocked_users;
CREATE TRIGGER tr_auto_unfriend_on_block
  AFTER INSERT ON public.blocked_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_unfriend_on_block();

-- ── 4. SECURITY DEFINER RPC FUNCTIONS ─────────────────────────────────────────

-- Block User RPC
CREATE OR REPLACE FUNCTION public.block_user(target_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inserted_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = target_user_id THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  -- Insert block record
  INSERT INTO public.blocked_users (blocker_id, blocked_id)
  VALUES (v_caller_id, target_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- Also auto-unfriend
  DELETE FROM public.friend_requests
  WHERE (sender_id = v_caller_id AND receiver_id = target_user_id)
     OR (sender_id = target_user_id AND receiver_id = v_caller_id);

  RETURN jsonb_build_object('success', true, 'blocked_id', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unblock User RPC
CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.blocked_users
  WHERE blocker_id = v_caller_id AND blocked_id = target_user_id;

  RETURN jsonb_build_object('success', true, 'unblocked_id', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if blocked bidirectionally
CREATE OR REPLACE FUNCTION public.is_blocked_bidirectional(user_a uuid, user_b uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── 5. REALTIME PUBLICATION ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
