-- ==============================================================================
-- RAKCHA APPLICATION - USER-SCOPED APPEARANCE & ACCENT PERSISTENCE
-- ==============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run All
--
-- Adds accent_color and theme columns to public.profiles table so appearance
-- preferences persist per user in the database.
-- ==============================================================================

-- 1. Add accent_color and theme columns if not already present
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accent_color text DEFAULT 'indigo';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark-slate';

-- 2. Backfill existing profiles with safe defaults
UPDATE public.profiles SET accent_color = 'indigo' WHERE accent_color IS NULL;
UPDATE public.profiles SET theme = 'dark-slate' WHERE theme IS NULL;

-- 3. Ensure profiles update policy allows users to update their own accent and theme
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" 
    ON public.profiles 
    FOR UPDATE 
    USING (auth.uid() = id);
  END IF;
END $$;
