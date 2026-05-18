-- ============================================================
-- FINAL RLS FIX — Run this in Supabase SQL Editor
-- ============================================================

-- Drop every existing policy on profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- Recreate clean policies
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Also fix student_profiles so the frontend can read it
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'student_profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON student_profiles', r.policyname);
  END LOOP;
END $$;

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_profiles_select_own"
  ON student_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "student_profiles_update_own"
  ON student_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "student_profiles_insert_own"
  ON student_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
