-- ==============================================================================
-- SECURE GROUP INVITATION CODE SYSTEM MIGRATION
-- ==============================================================================

-- 1. Create secure code generation function
-- Generates an 8-character uppercase alphanumeric code (excluding 0, O, 1, I) formatted as XXXX-XXXX
CREATE OR REPLACE FUNCTION public.generate_group_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text := '';
  i integer := 0;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    IF i = 4 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Update default on groups table
ALTER TABLE public.groups 
  ALTER COLUMN code SET DEFAULT public.generate_group_code();

-- 3. Update existing groups to use the new code format (if they are using the old MD5 format)
UPDATE public.groups
SET code = public.generate_group_code()
WHERE code NOT LIKE '____-____' AND type = 'group';

-- 4. Create regenerate_group_code RPC
CREATE OR REPLACE FUNCTION public.regenerate_group_code(p_group_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_new_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user is owner or admin of the group
  SELECT role INTO v_role
  FROM public.group_members
  WHERE group_id = p_group_id AND user_id = v_user_id;

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only group owners or admins can regenerate the invite code.';
  END IF;

  -- Generate new code and update
  v_new_code := public.generate_group_code();
  
  UPDATE public.groups
  SET code = v_new_code, updated_at = now()
  WHERE id = p_group_id;

  RETURN json_build_object('success', true, 'new_code', v_new_code);
END;
$$;

-- 5. Update join_group_by_code to handle formatting strictly
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

  -- Normalize input: uppercase, remove spaces, add hyphen if exactly 8 chars
  v_clean_code := upper(regexp_replace(code_input, '\s+', '', 'g'));
  IF length(v_clean_code) = 8 AND v_clean_code NOT LIKE '%-%' THEN
    v_clean_code := substr(v_clean_code, 1, 4) || '-' || substr(v_clean_code, 5, 4);
  END IF;

  -- Look up group by normalized code
  SELECT id INTO v_group_id
  FROM public.groups
  WHERE code = v_clean_code AND type = 'group';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired code';
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_group_id AND user_id = v_user_id) THEN
    RETURN json_build_object('id', v_group_id, 'success', true, 'already_member', true);
  END IF;

  -- Add member
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Return the group id so frontend can set activeGroupId
  RETURN json_build_object('id', v_group_id, 'success', true, 'already_member', false);
END;
$$;
