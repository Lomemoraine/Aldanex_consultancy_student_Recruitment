-- ============================================================
-- Fix triggers to use SECURITY DEFINER so they bypass RLS
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop and recreate the auto-application trigger with SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_student_application()
RETURNS TRIGGER
SECURITY DEFINER  -- runs as the function owner (postgres), bypasses RLS
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO applications (student_id, current_stage)
    VALUES (NEW.id, 'registered');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the student ID generator with SECURITY DEFINER
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  counter INT;
BEGIN
  IF NEW.role = 'student' THEN
    SELECT COUNT(*) + 1 INTO counter FROM profiles WHERE role = 'student';
    new_id := 'ALD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(counter::TEXT, 5, '0');
    NEW.student_id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate stage change logger with SECURITY DEFINER
CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    INSERT INTO application_stage_history (application_id, from_stage, to_stage)
    VALUES (NEW.id, OLD.current_stage, NEW.current_stage);
    NEW.stage_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate profile completion with SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_fields INT := 20;
  filled_fields INT := 0;
  pct INT;
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.gender IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.address IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.passport_number IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.passport_expiry IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.highest_qualification IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.qualification_level IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.institution_attended IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.graduation_year IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.gpa IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.english_test_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.english_test_score IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.preferred_course IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.preferred_intake IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.budget_range IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.preferred_countries IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.sponsorship_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.employment_background IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.country IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.city IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;

  pct := LEAST(100, (filled_fields * 100) / total_fields);
  NEW.profile_completion_pct := pct;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
