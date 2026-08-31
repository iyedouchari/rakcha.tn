-- ==============================================================================
-- RAKCHA APPLICATION - STORAGE CONFIGURATION FOR VOCALS & CHAT MEDIA
-- ==============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- This script ensures the 'chat-media' bucket exists and is publicly readable,
-- allowing authenticated users to upload voice messages and stream vocals.
-- ==============================================================================

-- 1. Create 'chat-media' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  52428800, -- 50 MB limit
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800;

-- 2. Storage Policies for 'chat-media'

-- Policy A: Allow public access to view / stream media and vocals
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;
CREATE POLICY "Public can view chat media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

-- Policy B: Allow authenticated users to upload vocals and media
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Policy C: Allow users to update their uploaded media
DROP POLICY IF EXISTS "Authenticated users can update own chat media" ON storage.objects;
CREATE POLICY "Authenticated users can update own chat media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-media' AND (auth.uid() = owner OR owner IS NULL));

-- Policy D: Allow users to delete their own chat media
DROP POLICY IF EXISTS "Authenticated users can delete own chat media" ON storage.objects;
CREATE POLICY "Authenticated users can delete own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND (auth.uid() = owner OR owner IS NULL));
