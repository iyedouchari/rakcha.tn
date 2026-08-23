-- ==============================================================================
-- RAKCHA APPLICATION - COMPLETE DATABASE SCHEMA (CORRECTED & PRODUCTION-READY)
-- ==============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run All
--
-- KEY CORRECTIONS from original draft:
--   1. profiles.full_name  →  display_name   (matches frontend)
--   2. profiles.bio        →  custom_status  (matches frontend store)
--   3. groups.created_by   →  creator_id     (matches frontend createGroup call)
--   4. user_invitations    →  friend_requests (matches frontend store)
--   5. join_group_by_code  param: code_input, returns {id} (matches frontend)
--   6. Added group code auto-generation trigger
--   7. Username constraint relaxed to allow @ prefix stored from frontend
--   8. Added INSERT policies for group_members (required for createGroup RPC)
--   9. Profiles INSERT policy added (SECURITY DEFINER trigger bypass)
--  10. groups SELECT policy allows public code lookup for joining
--  11. Separated DMs from groups using user1_id and user2_id natively
--  12. Added muted_users table and unfriend_user RPC
-- ==============================================================================


-- ==============================================================================
-- 0. WIPE EXISTING DATABASE (DANGER: THIS DELETES ALL EXISTING DATA)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.unfriend_user(uuid);
DROP FUNCTION IF EXISTS public.join_group_by_code(text);
DROP FUNCTION IF EXISTS public.search_users_by_username(text);
DROP FUNCTION IF EXISTS public.create_direct_message(uuid);
DROP TABLE IF EXISTS public.muted_users CASCADE;
DROP TABLE IF EXISTS public.call_participants CASCADE;
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==============================================================================
-- 1. EXTENSIONS & UTILS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ==============================================================================
-- 2. TABLES & CONSTRAINTS
-- ==============================================================================

-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Linked 1-to-1 with Supabase Auth. Auto-created via trigger on sign-up.
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text        UNIQUE,
  display_name  text,
  avatar_url    text,
  custom_status text,                    -- bio / status message shown in UI
  banner_color  text        DEFAULT 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
  status        text        DEFAULT 'offline'
                            CHECK (status IN ('online', 'offline', 'away')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  -- Allow optional @ prefix (stored by frontend as e.g. "@john_doe")
  CONSTRAINT valid_username_format CHECK (
    username IS NULL
    OR username ~ '^@?[a-z0-9_]{2,30}$'
  )
);

-- Ensure banner_color column exists if migrating existing database
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_color text DEFAULT 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)';

-- ── FRIEND REQUESTS ───────────────────────────────────────────────────────────
-- Unique constraint prevents two pending requests between the same pair.
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT no_self_invite CHECK (sender_id != receiver_id)
);

-- Ensure there are never duplicate pending or accepted requests in either direction
CREATE UNIQUE INDEX unique_friendship_bidirectional 
  ON public.friend_requests (
    LEAST(sender_id, receiver_id), 
    GREATEST(sender_id, receiver_id)
  );

-- ── MUTED USERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.muted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, muted_user_id)
);

-- ── GROUPS / ROOMS / DMs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  code        text        UNIQUE NOT NULL DEFAULT upper(substring(md5(gen_random_uuid()::text) from 1 for 8)),
  avatar_url  text,
  creator_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_private  boolean     DEFAULT true,
  type        text        DEFAULT 'group' CHECK (type IN ('group', 'private')),
  user1_id    uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id    uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Ensure existing groups table has the newer columns (if user runs this on an existing DB)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS code text UNIQUE DEFAULT upper(substring(md5(gen_random_uuid()::text) from 1 for 8));
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS type text DEFAULT 'group' CHECK (type IN ('group', 'private'));
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS user1_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS user2_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── GROUP MEMBERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid        NOT NULL REFERENCES public.groups(id)  ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      text        NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- ── MESSAGES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid        NOT NULL REFERENCES public.groups(id)   ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    text,
  media_url  text,
  media_type text        CHECK (media_type IN ('image', 'video', 'audio', 'file')),
  is_edited  boolean     DEFAULT false,
  waveform   jsonb,
  duration   numeric,
  reply_to_id uuid       REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── MESSAGE REACTIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid        NOT NULL REFERENCES public.messages(id)  ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  emoji      text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- ── CALL PARTICIPANTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_participants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid        NOT NULL REFERENCES public.groups(id)   ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'joined'
                         CHECK (status IN ('joined', 'left', 'muted')),
  joined_at  timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);


-- ==============================================================================
-- 3. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username        ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_invitations_receiver     ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_sender       ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user       ON public.group_members(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group      ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_created   ON public.messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_message        ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_calls_group              ON public.call_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_code              ON public.groups(code);


-- ==============================================================================
-- 4. AUTOMATION TRIGGERS
-- ==============================================================================

-- ── Shared updated_at handler ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_timestamp     ON public.profiles;
DROP TRIGGER IF EXISTS set_invitations_timestamp  ON public.friend_requests;
DROP TRIGGER IF EXISTS set_groups_timestamp       ON public.groups;
DROP TRIGGER IF EXISTS set_messages_timestamp     ON public.messages;
DROP TRIGGER IF EXISTS set_calls_timestamp        ON public.call_participants;

CREATE TRIGGER set_profiles_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_invitations_timestamp
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_groups_timestamp
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_messages_timestamp
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_calls_timestamp
  BEFORE UPDATE ON public.call_participants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Auto-create profile on new auth.users row ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _raw_username text;
  _safe_username text;
BEGIN
  -- Sanitize the provided username, or fallback to email prefix
  _raw_username := NEW.raw_user_meta_data->>'username';
  
  IF _raw_username IS NOT NULL THEN
    _safe_username := regexp_replace(lower(_raw_username), '[^a-z0-9_]', '_', 'g');
  ELSE
    _safe_username := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '_', 'g');
  END IF;
  
  -- Ensure minimum length
  IF length(_safe_username) < 2 THEN
    _safe_username := _safe_username || '_user';
  END IF;
  -- Truncate to 30 chars
  _safe_username := left(_safe_username, 30);

  INSERT INTO public.profiles (id, display_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', _safe_username),
    _safe_username,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url',   '')
  )
  ON CONFLICT (id) DO NOTHING;  -- safe to re-run
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Auto-add group creator as owner ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();


-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- ── SECURITY DEFINER FUNCTIONS (Prevents Infinite Recursion) ──────────────────
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND type = 'private' AND (user1_id = _user_id OR user2_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role IN ('owner', 'admin')
  );
END;
$$;

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants  ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"            ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ── Friend Requests ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see their own requests"  ON public.friend_requests;
DROP POLICY IF EXISTS "Users can send requests"       ON public.friend_requests;
DROP POLICY IF EXISTS "Receiver can update status"    ON public.friend_requests;
DROP POLICY IF EXISTS "Receiver can delete request"   ON public.friend_requests;

CREATE POLICY "Users see their own requests"
  ON public.friend_requests FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send requests"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receiver can update status"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

CREATE POLICY "Receiver can delete request"
  ON public.friend_requests FOR DELETE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- ── Muted Users ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their muted users" ON public.muted_users;
DROP POLICY IF EXISTS "Users can mute users" ON public.muted_users;
DROP POLICY IF EXISTS "Users can unmute users" ON public.muted_users;

CREATE POLICY "Users can view their muted users" 
  ON public.muted_users FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mute users" 
  ON public.muted_users FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmute users" 
  ON public.muted_users FOR DELETE USING (auth.uid() = user_id);

-- ── Groups ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view their groups"    ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Owners and admins can update group"    ON public.groups;
DROP POLICY IF EXISTS "Groups viewable by code for joining"   ON public.groups;

CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT TO authenticated
  USING ( public.is_group_member(groups.id, auth.uid()) );

CREATE POLICY "Groups viewable by code for joining"
  ON public.groups FOR SELECT TO authenticated
  USING (true);  

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Owners and admins can update group"
  ON public.groups FOR UPDATE TO authenticated
  USING ( public.is_group_admin(groups.id, auth.uid()) );

-- ── Group Members ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view other members"    ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups"             ON public.group_members;
DROP POLICY IF EXISTS "Members can leave or be removed"   ON public.group_members;

CREATE POLICY "Members can view other members"
  ON public.group_members FOR SELECT TO authenticated
  USING ( public.is_group_member(group_members.group_id, auth.uid()) );

CREATE POLICY "Users can join groups"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can leave or be removed"
  ON public.group_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_group_admin(group_members.group_id, auth.uid())
  );

-- ── Messages ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view messages"            ON public.messages;
DROP POLICY IF EXISTS "Members can insert messages"          ON public.messages;
DROP POLICY IF EXISTS "Senders can edit their own messages"  ON public.messages;
DROP POLICY IF EXISTS "Senders or admins can delete messages" ON public.messages;

CREATE POLICY "Members can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING ( public.is_group_member(messages.group_id, auth.uid()) );

CREATE POLICY "Members can insert messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_group_member(messages.group_id, auth.uid())
  );

CREATE POLICY "Senders can edit their own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders or admins can delete messages"
  ON public.messages FOR DELETE TO authenticated
  USING (
    auth.uid() = sender_id
    OR public.is_group_admin(messages.group_id, auth.uid())
  );

-- ── Message Reactions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view reactions"         ON public.message_reactions;
DROP POLICY IF EXISTS "Members can add reactions"          ON public.message_reactions;
DROP POLICY IF EXISTS "Users can remove their reactions"   ON public.message_reactions;

CREATE POLICY "Members can view reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND public.is_group_member(m.group_id, auth.uid())
    )
  );

CREATE POLICY "Members can add reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── Call Participants ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Users manage their own call status" ON public.call_participants;

CREATE POLICY "Members can view call participants"
  ON public.call_participants FOR SELECT TO authenticated
  USING ( public.is_group_member(call_participants.group_id, auth.uid()) );

CREATE POLICY "Users manage their own call status"
  ON public.call_participants FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ==============================================================================
-- 6. STORED PROCEDURES / RPC FUNCTIONS
-- ==============================================================================

-- ── search_users_by_username ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_users_by_username(search_term text)
RETURNS TABLE (
  id           uuid,
  display_name text,
  username     text,
  avatar_url   text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, display_name, username, avatar_url
  FROM public.profiles
  WHERE (
    username ILIKE '%' || regexp_replace(search_term, '^@+', '') || '%'
    OR username ILIKE '%@' || regexp_replace(search_term, '^@+', '') || '%'
  )
    AND id != auth.uid()
  ORDER BY username
  LIMIT 15;
$$;

-- ── join_group_by_code ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_group_by_code(code_input text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_id uuid;
  v_user_id  uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Look up group by code (case-insensitive)
  SELECT id INTO v_group_id
  FROM public.groups
  WHERE upper(code) = upper(code_input);

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid group code: %', code_input;
  END IF;

  -- Add member (ignore if already a member thanks to ON CONFLICT DO NOTHING)
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Return the group id so frontend can set activeGroupId
  RETURN json_build_object('id', v_group_id, 'success', true);
END;
$$;

-- ── unfriend_user ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unfriend_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated'; 
  END IF;

  -- Verify friendship and delete it
  DELETE FROM public.friend_requests
  WHERE status = 'accepted'
    AND ((sender_id = v_user_id AND receiver_id = target_user_id)
         OR (sender_id = target_user_id AND receiver_id = v_user_id));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship does not exist';
  END IF;

  -- Find the DM conversation using native user_ids (or fallback to code)
  SELECT id INTO v_group_id
  FROM public.groups
  WHERE type = 'private' 
    AND ((user1_id = v_user_id AND user2_id = target_user_id)
      OR (user1_id = target_user_id AND user2_id = v_user_id));

  -- Fallback logic for legacy code-based DMs just in case
  IF v_group_id IS NULL THEN
    v_code := 'DM_' || upper(substring(LEAST(v_user_id::text, target_user_id::text) from 1 for 8)) || '_' || upper(substring(GREATEST(v_user_id::text, target_user_id::text) from 1 for 8));
    SELECT id INTO v_group_id FROM public.groups WHERE code = v_code AND type = 'private';
  END IF;

  IF v_group_id IS NOT NULL THEN
    -- Cascade deletes: Deleting the group will delete group_members, messages, and call_participants because of ON DELETE CASCADE in the schema.
    DELETE FROM public.groups WHERE id = v_group_id;
  END IF;
  
  -- Also remove from muted users just in case
  DELETE FROM public.muted_users 
  WHERE (user_id = v_user_id AND muted_user_id = target_user_id)
     OR (user_id = target_user_id AND muted_user_id = v_user_id);

END;
$$;

-- ── create_group ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_group(
  group_name text,
  group_description text,
  group_avatar_url text
)
RETURNS public.groups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_group public.groups;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.groups (name, description, avatar_url, creator_id, type, is_private)
  VALUES (group_name, group_description, group_avatar_url, v_user_id, 'group', true)
  RETURNING * INTO v_new_group;

  -- The on_group_created trigger handles adding the user to group_members automatically.
  
  RETURN v_new_group;
END;
$$;

-- ==============================================================================
-- 7. REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.muted_users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- END OF SCHEMA
-- ==============================================================================
