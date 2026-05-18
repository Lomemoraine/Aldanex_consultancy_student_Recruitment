-- ============================================================
-- Functions & Triggers
-- ============================================================

-- Auto-generate student ID on profile creation
-- Uses a sequence to guarantee uniqueness (COUNT(*) causes race conditions)
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' AND (NEW.student_id IS NULL OR NEW.student_id = '') THEN
    NEW.student_id := 'ALD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('student_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_student_id
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_student_id();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_student_profiles_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_university_apps_updated_at BEFORE UPDATE ON university_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_offer_letters_updated_at BEFORE UPDATE ON offer_letters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_tuition_deposits_updated_at BEFORE UPDATE ON tuition_deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_visa_applications_updated_at BEFORE UPDATE ON visa_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Log stage changes automatically
CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    INSERT INTO application_stage_history (application_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.current_stage, NEW.current_stage, auth.uid());
    NEW.stage_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_stage_change
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION log_stage_change();

-- Auto-create application when student profile is created
CREATE OR REPLACE FUNCTION create_student_application()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO applications (student_id, current_stage)
    VALUES (NEW.id, 'registered');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_application
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_student_application();

-- Update profile completion percentage
CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
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
  IF NEW.date_of_birth IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.country IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;

  pct := LEAST(100, (filled_fields * 100) / total_fields);
  NEW.profile_completion_pct := pct;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profile_completion
  BEFORE INSERT OR UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_completion();
