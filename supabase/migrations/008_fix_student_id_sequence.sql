-- ============================================================
-- Fix student_id generation to use a proper sequence
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create a dedicated sequence for student IDs
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 1;

-- Drop and recreate the trigger function using the sequence
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  next_val BIGINT;
BEGIN
  IF NEW.role = 'student' AND (NEW.student_id IS NULL OR NEW.student_id = '') THEN
    next_val := nextval('student_id_seq');
    new_id := 'ALD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(next_val::TEXT, 5, '0');
    NEW.student_id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync the sequence to the current max to avoid conflicts with existing records
SELECT setval('student_id_seq', COALESCE(
  (SELECT MAX(CAST(SPLIT_PART(student_id, '-', 3) AS BIGINT))
   FROM profiles
   WHERE student_id IS NOT NULL
     AND student_id ~ '^ALD-[0-9]{4}-[0-9]+$'),
  0
));
