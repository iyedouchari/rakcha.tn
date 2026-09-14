-- ==============================================================================
-- RAKCHA — GROUP CALLS & AUTOMATED SYSTEM EVENTS MIGRATION
-- ==============================================================================
-- Run AFTER rakcha_schema.sql and rakcha_schema_group_codes.sql
-- Safe to re-run; uses IF NOT EXISTS / OR REPLACE / DO $$ blocks throughout.
-- Does NOT wipe any existing data.
-- ==============================================================================


-- ==============================================================================
-- 1. EXTEND messages TABLE — add message_type discriminator
-- ==============================================================================

-- Add message_type to distinguish system events from normal chat messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'message'
    CHECK (message_type IN ('message', 'system', 'call_start', 'call_end'));

-- Add call_session_id so call_start/call_end messages link to the session
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS call_session_id uuid;

-- Index for fast pill lookups per group
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(group_id, message_type);


-- ==============================================================================
-- 2. CALL SESSIONS TABLE — one active session per group at a time
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.call_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  started_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  call_type   text        NOT NULL DEFAULT 'video' CHECK (call_type IN ('audio', 'video')),
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  duration_s  integer,   -- filled on end
  created_at  timestamptz DEFAULT now()
);

-- Ensure status column exists if table was already created
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Only one active (non-ended) call per group
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_active_group
  ON public.call_sessions(group_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_call_sessions_group ON public.call_sessions(group_id);


-- ==============================================================================
-- 3. EXTEND call_participants — link to a call_session
-- ==============================================================================

ALTER TABLE public.call_participants
  ADD COLUMN IF NOT EXISTS call_session_id uuid REFERENCES public.call_sessions(id) ON DELETE CASCADE;

-- Add mic/camera state columns for UI display
ALTER TABLE public.call_participants
  ADD COLUMN IF NOT EXISTS is_muted  boolean DEFAULT false;
ALTER TABLE public.call_participants
  ADD COLUMN IF NOT EXISTS has_video boolean DEFAULT true;


-- ==============================================================================
-- 4. RLS FOR call_sessions
-- ==============================================================================

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view call sessions"                  ON public.call_sessions;
DROP POLICY IF EXISTS "Group members can create call sessions"                ON public.call_sessions;
DROP POLICY IF EXISTS "Session admin can end session"                         ON public.call_sessions;
DROP POLICY IF EXISTS "Session participants and admins can update session"    ON public.call_sessions;

CREATE POLICY "Group members can view call sessions"
  ON public.call_sessions FOR SELECT TO authenticated
  USING ( public.is_group_member(call_sessions.group_id, auth.uid()) );

CREATE POLICY "Group members can create call sessions"
  ON public.call_sessions FOR INSERT TO authenticated
  WITH CHECK ( public.is_group_member(call_sessions.group_id, auth.uid()) );

CREATE POLICY "Session participants and admins can update session"
  ON public.call_sessions FOR UPDATE TO authenticated
  USING (
    auth.uid() = started_by
    OR public.is_group_admin(call_sessions.group_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.call_participants
      WHERE call_session_id = call_sessions.id AND user_id = auth.uid()
    )
  );


-- ==============================================================================
-- 5. HELPER — post a system message (SECURITY DEFINER, bypasses sender check)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.post_system_message(
  p_group_id      uuid,
  p_actor_id      uuid,
  p_content       text,
  p_msg_type      text DEFAULT 'system',
  p_session_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg_id uuid;
BEGIN
  INSERT INTO public.messages (
    group_id, sender_id, content, message_type, call_session_id
  )
  VALUES (
    p_group_id, p_actor_id, p_content, p_msg_type, p_session_id
  )
  RETURNING id INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;


-- ==============================================================================
-- 6. TRIGGERS — automated group membership event messages
-- ==============================================================================

-- ── Trigger function: member JOINED ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_member_joined()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display_name text;
  v_group_type   text;
BEGIN
  -- Only post system messages for 'group' type conversations, not DMs
  SELECT type INTO v_group_type FROM public.groups WHERE id = NEW.group_id;
  IF v_group_type IS DISTINCT FROM 'group' THEN
    RETURN NEW;
  END IF;

  -- Don't post a join message for the owner (group creator on creation)
  IF NEW.role = 'owner' THEN
    RETURN NEW;
  END IF;

  -- Get actor's display name
  SELECT COALESCE(display_name, username, 'Someone')
  INTO v_display_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- CRITICAL: wrap in exception so a failed system message NEVER blocks the join
  BEGIN
    PERFORM public.post_system_message(
      NEW.group_id,
      NEW.user_id,
      v_display_name || ' joined the group',
      'system',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- swallow silently; membership insert must succeed regardless
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_member_joined ON public.group_members;
CREATE TRIGGER on_member_joined
  AFTER INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_joined();


-- ── Trigger function: member LEFT or REMOVED ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_member_left()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display_name text;
  v_group_type   text;
  v_actor_id     uuid;
  v_msg_text     text;
BEGIN
  -- Only post system messages for 'group' type conversations
  SELECT type INTO v_group_type FROM public.groups WHERE id = OLD.group_id;
  IF v_group_type IS DISTINCT FROM 'group' THEN
    RETURN OLD;
  END IF;

  -- Get departed member's display name
  SELECT COALESCE(display_name, username, 'Someone')
  INTO v_display_name
  FROM public.profiles
  WHERE id = OLD.user_id;

  -- auth.uid() is the actor who performed the DELETE
  v_actor_id := auth.uid();

  IF v_actor_id IS NOT NULL AND v_actor_id IS DISTINCT FROM OLD.user_id THEN
    -- An admin/owner removed this person
    v_msg_text := v_display_name || ' was removed from the group';
  ELSE
    -- User left voluntarily
    v_msg_text := v_display_name || ' left the group';
  END IF;

  -- CRITICAL: wrap in exception so a failed system message NEVER blocks the leave/kick
  BEGIN
    PERFORM public.post_system_message(
      OLD.group_id,
      OLD.user_id,
      v_msg_text,
      'system',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- swallow silently; membership delete must succeed regardless
  END;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_member_left ON public.group_members;
CREATE TRIGGER on_member_left
  AFTER DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_left();


-- ==============================================================================
-- 7. RPC — start_group_call
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.start_group_call(
  p_group_id  uuid,
  p_call_type text DEFAULT 'video'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_session_id  uuid;
  v_msg_id      uuid;
  v_display_name text;
  v_existing    uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify caller is a member
  IF NOT public.is_group_member(p_group_id, v_user_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Check if there is already an active call session for this group
  SELECT id INTO v_existing
  FROM public.call_sessions
  WHERE group_id = p_group_id AND ended_at IS NULL;

  IF v_existing IS NOT NULL THEN
    -- Return the existing session for the caller to join
    RETURN json_build_object('session_id', v_existing, 'already_active', true);
  END IF;

  -- Create new session
  INSERT INTO public.call_sessions (group_id, started_by, call_type)
  VALUES (p_group_id, v_user_id, p_call_type)
  RETURNING id INTO v_session_id;

  -- Add caller as first participant
  INSERT INTO public.call_participants (group_id, user_id, call_session_id, status)
  VALUES (p_group_id, v_user_id, v_session_id, 'joined')
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET call_session_id = v_session_id, status = 'joined', updated_at = now();

  -- Get display name for system message
  SELECT COALESCE(display_name, username, 'Someone')
  INTO v_display_name
  FROM public.profiles
  WHERE id = v_user_id;

  -- Post "call_start" system message
  v_msg_id := public.post_system_message(
    p_group_id,
    v_user_id,
    v_display_name || ' started a group call',
    'call_start',
    v_session_id
  );

  RETURN json_build_object(
    'session_id',   v_session_id,
    'msg_id',       v_msg_id,
    'already_active', false
  );
END;
$$;


-- ==============================================================================
-- 8. RPC — join_call_session
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.join_call_session(
  p_session_id uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_group_id uuid;
  v_type     text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT group_id, call_type INTO v_group_id, v_type
  FROM public.call_sessions
  WHERE id = p_session_id AND ended_at IS NULL;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Call session not found or already ended';
  END IF;

  IF NOT public.is_group_member(v_group_id, v_user_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  INSERT INTO public.call_participants (group_id, user_id, call_session_id, status)
  VALUES (v_group_id, v_user_id, p_session_id, 'joined')
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET call_session_id = p_session_id, status = 'joined', updated_at = now();

  RETURN json_build_object('success', true, 'group_id', v_group_id, 'call_type', v_type);
END;
$$;


-- ==============================================================================
-- 9. RPC — leave_call_session
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.leave_call_session(
  p_session_id uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_group_id     uuid;
  v_participant_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT group_id INTO v_group_id
  FROM public.call_sessions
  WHERE id = p_session_id AND ended_at IS NULL;

  IF v_group_id IS NULL THEN
    -- Session already ended, just clean up participant row if it exists
    DELETE FROM public.call_participants
    WHERE call_session_id = p_session_id AND user_id = v_user_id;
    RETURN json_build_object('success', true, 'session_ended', true);
  END IF;

  -- Remove this participant
  DELETE FROM public.call_participants
  WHERE call_session_id = p_session_id AND user_id = v_user_id;

  -- Count remaining active participants
  SELECT COUNT(*) INTO v_participant_count
  FROM public.call_participants
  WHERE call_session_id = p_session_id AND status = 'joined';

  -- If no one is left, auto-end the session
  IF v_participant_count = 0 THEN
    PERFORM public.end_group_call(p_session_id);
    RETURN json_build_object('success', true, 'session_ended', true);
  END IF;

  RETURN json_build_object('success', true, 'session_ended', false, 'remaining', v_participant_count);
END;
$$;


-- ==============================================================================
-- 10. RPC — end_group_call
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.end_group_call(
  p_session_id uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_group_id   uuid;
  v_started_at timestamptz;
  v_duration_s integer;
  v_dur_text   text;
  v_mins       integer;
  v_secs       integer;
BEGIN
  SELECT group_id, started_at
  INTO v_group_id, v_started_at
  FROM public.call_sessions
  WHERE id = p_session_id AND ended_at IS NULL;

  IF v_group_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'already_ended');
  END IF;

  -- Calculate duration
  v_duration_s := EXTRACT(EPOCH FROM (now() - v_started_at))::integer;
  v_mins := v_duration_s / 60;
  v_secs := v_duration_s % 60;

  IF v_mins > 0 THEN
    v_dur_text := v_mins || 'm ' || v_secs || 's';
  ELSE
    v_dur_text := v_secs || 's';
  END IF;

  -- Mark session as ended
  UPDATE public.call_sessions
  SET ended_at = now(), duration_s = v_duration_s, status = 'completed'
  WHERE id = p_session_id;

  -- Clear all remaining participant rows for this session
  DELETE FROM public.call_participants
  WHERE call_session_id = p_session_id;

  -- Update the call_start message to call_end with duration
  -- First try to update existing call_start message for this session
  UPDATE public.messages
  SET
    message_type = 'call_end',
    content      = 'Group call ended • ' || v_dur_text,
    updated_at   = now()
  WHERE call_session_id = p_session_id AND message_type = 'call_start';

  -- If no call_start message found, insert a new call_end message
  -- (edge case: message was deleted)
  IF NOT FOUND THEN
    PERFORM public.post_system_message(
      v_group_id,
      COALESCE(v_user_id, (SELECT started_by FROM public.call_sessions WHERE id = p_session_id)),
      'Group call ended • ' || v_dur_text,
      'call_end',
      p_session_id
    );
  END IF;

  RETURN json_build_object('success', true, 'duration_s', v_duration_s, 'duration_text', v_dur_text);
END;
$$;


-- ==============================================================================
-- 11. RPC — get_active_call_session (for banner display)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_active_call_session(p_group_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_count   integer;
BEGIN
  SELECT cs.id, cs.group_id, cs.started_by, cs.call_type, cs.started_at,
         p.display_name AS starter_name, p.avatar_url AS starter_avatar
  INTO v_session
  FROM public.call_sessions cs
  JOIN public.profiles p ON p.id = cs.started_by
  WHERE cs.group_id = p_group_id AND cs.ended_at IS NULL
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.call_participants
  WHERE call_session_id = v_session.id AND status = 'joined';

  RETURN json_build_object(
    'id',           v_session.id,
    'group_id',     v_session.group_id,
    'started_by',   v_session.started_by,
    'call_type',    v_session.call_type,
    'started_at',   v_session.started_at,
    'starter_name', v_session.starter_name,
    'participant_count', v_count
  );
END;
$$;


-- ==============================================================================
-- 12. REALTIME — add call_sessions to publication
-- ==============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Also ensure call_participants is published (already in main schema, but safe to re-add)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ==============================================================================
-- 13. SYSTEM MESSAGE RLS UPDATE
-- ==============================================================================
-- System messages use SECURITY DEFINER RPCs and have sender_id = the acting user.
-- The existing "Members can insert messages" policy requires sender_id = auth.uid(),
-- which is satisfied since the DEFINER functions run as the calling user's auth context.
-- No policy change needed — SECURITY DEFINER functions bypass RLS by default.

-- However, we need to make sure the post_system_message helper is called with a valid
-- auth context. Grant execute to authenticated role.
GRANT EXECUTE ON FUNCTION public.post_system_message(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_group_call(uuid, text)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_call_session(uuid)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_call_session(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_group_call(uuid)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_call_session(uuid)                    TO authenticated;


-- ==============================================================================
-- 14. RESTORE XXXX-XXXX CODE FORMAT & join_group_by_code
-- ==============================================================================
-- Re-apply the generate_group_code() default (safe, idempotent)
ALTER TABLE public.groups
  ALTER COLUMN code SET DEFAULT public.generate_group_code();

-- Restore join_group_by_code with strict XXXX-XXXX normalization
-- (mirrors rakcha_schema_group_codes.sql exactly)
CREATE OR REPLACE FUNCTION public.join_group_by_code(code_input text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_id uuid;
  v_user_id  uuid := auth.uid();
  v_clean_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Normalize: uppercase, strip spaces, insert hyphen if plain 8 chars
  v_clean_code := upper(regexp_replace(code_input, '\s+', '', 'g'));
  IF length(v_clean_code) = 8 AND v_clean_code NOT LIKE '%-%' THEN
    v_clean_code := substr(v_clean_code, 1, 4) || '-' || substr(v_clean_code, 5, 4);
  END IF;

  -- Look up group by normalized XXXX-XXXX code
  SELECT id INTO v_group_id
  FROM public.groups
  WHERE code = v_clean_code AND type = 'group';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired code';
  END IF;

  -- Already a member?
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_group_id AND user_id = v_user_id) THEN
    RETURN json_build_object('id', v_group_id, 'success', true, 'already_member', true);
  END IF;

  -- Add member (trigger fires but is now exception-safe)
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN json_build_object('id', v_group_id, 'success', true, 'already_member', false);
END;
$$;


-- ==============================================================================
-- END OF GROUP CALLS MIGRATION
-- ==============================================================================
