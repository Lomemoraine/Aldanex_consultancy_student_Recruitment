-- ============================================================
-- Repair user data — Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Remove duplicate profiles (keep the most recent one)
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
    FROM profiles
  ) t
  WHERE rn > 1
);

-- Step 2: Ensure every auth user has a profiles row
INSERT INTO profiles (id, role, full_name, email)
SELECT 
  u.id,
  'student',
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Ensure every student profile has a student_profiles row
INSERT INTO student_profiles (user_id)
SELECT p.id
FROM profiles p
LEFT JOIN student_profiles sp ON sp.user_id = p.id
WHERE p.role = 'student'
  AND sp.user_id IS NULL
ON CONFLICT DO NOTHING;

-- Step 4: Ensure every student has an application
INSERT INTO applications (student_id, current_stage)
SELECT p.id, 'registered'
FROM profiles p
LEFT JOIN applications a ON a.student_id = p.id
WHERE p.role = 'student'
  AND a.student_id IS NULL
ON CONFLICT DO NOTHING;

-- Step 5: Verify the fix
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.role,
  p.student_id,
  CASE WHEN sp.user_id IS NOT NULL THEN 'YES' ELSE 'MISSING' END AS has_student_profile,
  CASE WHEN a.student_id IS NOT NULL THEN 'YES' ELSE 'MISSING' END AS has_application
FROM profiles p
LEFT JOIN student_profiles sp ON sp.user_id = p.id
LEFT JOIN applications a ON a.student_id = p.id
WHERE p.role = 'student'
ORDER BY p.created_at DESC;
