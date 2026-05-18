-- ============================================================
-- FINAL RLS FIX — Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Drop every existing policy on profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- Step 2: Disable RLS on profiles temporarily, then re-enable with correct policies
-- The backend uses service_role which bypasses RLS anyway,
-- but we need clean policies for the frontend anon/user reads.

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to update their own profile  
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow service_role to do everything (backend API)
-- Note: service_role bypasses RLS by default, so this is just for clarity

-- Step 3: Also fix applications table RLS (same recursion risk)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'applications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON applications', r.policyname);
  END LOOP;
END $$;

ALTER TABLE applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_select_own"
  ON applications FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "applications_update_own"
  ON applications FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

-- Step 4: Fix documents RLS
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'documents' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON documents', r.policyname);
  END LOOP;
END $$;

ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own"
  ON documents FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Step 5: Fix notifications RLS
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', r.policyname);
  END LOOP;
END $$;

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Step 6: Fix messages RLS
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON messages', r.policyname);
  END LOOP;
END $$;

ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Step 7: Fix payments RLS
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'payments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON payments', r.policyname);
  END LOOP;
END $$;

ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_own"
  ON payments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());
