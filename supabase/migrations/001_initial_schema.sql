-- ============================================================
-- Aldanex ERP - Initial Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('student', 'counselor', 'admissions', 'visa_officer', 'admin');

CREATE TYPE application_stage AS ENUM (
  'registered',
  'profile_completion',
  'document_upload',
  'initial_assessment',
  'counseling',
  'university_selection',
  'application_submission',
  'offer_letter',
  'tuition_deposit',
  'visa_application',
  'pre_departure',
  'enrolled'
);

CREATE TYPE document_status AS ENUM ('pending', 'uploaded', 'under_review', 'approved', 'rejected', 'resubmit_requested');

CREATE TYPE offer_outcome AS ENUM ('conditional', 'unconditional', 'waitlisted', 'rejected');

CREATE TYPE offer_status AS ENUM ('pending_review', 'accepted', 'declined');

CREATE TYPE visa_status AS ENUM ('not_started', 'documents_submitted', 'biometrics_booked', 'submitted', 'approved', 'rejected');

CREATE TYPE payment_status AS ENUM ('pending', 'uploaded', 'verified', 'failed');

CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'action_required');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'student',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  nationality TEXT,
  preferred_study_destination TEXT,
  student_id TEXT UNIQUE, -- auto-generated for students
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT PROFILES (detailed info)
-- ============================================================

CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Personal Info
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  country TEXT,

  -- Passport Info
  passport_number TEXT,
  passport_expiry DATE,
  passport_country TEXT,

  -- Educational Background
  highest_qualification TEXT,
  qualification_level TEXT, -- e.g. Bachelor, Master, PhD
  institution_attended TEXT,
  graduation_year INT,
  gpa NUMERIC(4,2),

  -- English Proficiency
  english_test_type TEXT, -- IELTS, TOEFL, PTE, Duolingo
  english_test_score TEXT,
  english_test_date DATE,

  -- Preferences
  preferred_course TEXT,
  preferred_intake TEXT, -- e.g. September 2025
  budget_range TEXT,
  preferred_countries TEXT[], -- array of countries
  preferred_universities TEXT[],

  -- Sponsorship & Employment
  sponsorship_type TEXT, -- self, family, government, scholarship
  employment_background TEXT,

  -- Profile completion
  profile_completion_pct INT DEFAULT 0,
  is_submitted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPLICATIONS
-- ============================================================

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_counselor_id UUID REFERENCES profiles(id),
  assigned_admissions_id UUID REFERENCES profiles(id),

  current_stage application_stage NOT NULL DEFAULT 'registered',
  stage_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Internal notes
  counselor_notes TEXT,
  internal_notes TEXT,

  -- Eligibility scoring
  eligibility_score INT,
  eligibility_notes TEXT,

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAGE HISTORY (audit trail)
-- ============================================================

CREATE TABLE application_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_stage application_stage,
  to_stage application_stage NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TYPE document_category AS ENUM (
  'academic',
  'identification',
  'english_proficiency',
  'financial',
  'additional',
  'visa',
  'travel'
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  category document_category NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT, -- Supabase Storage URL
  file_type TEXT, -- pdf, jpg, png
  file_size_kb INT,

  status document_status DEFAULT 'pending',
  reviewer_id UUID REFERENCES profiles(id),
  reviewer_notes TEXT,
  expiry_date DATE,

  uploaded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COUNSELING SESSIONS
-- ============================================================

CREATE TABLE counseling_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),
  counselor_id UUID NOT NULL REFERENCES profiles(id),

  session_type TEXT, -- virtual, physical
  platform TEXT, -- Zoom, Google Meet, in-person
  meeting_link TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,

  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, rescheduled
  meeting_notes TEXT,
  recommendations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UNIVERSITY APPLICATIONS
-- ============================================================

CREATE TABLE university_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),

  university_name TEXT NOT NULL,
  university_country TEXT,
  course_name TEXT NOT NULL,
  intake TEXT,

  -- Submission
  submitted_at TIMESTAMPTZ,
  reference_number TEXT,
  portal_username TEXT,

  -- SOP & forms
  sop_url TEXT,
  application_form_url TEXT,

  -- Application fee
  application_fee NUMERIC(10,2),
  fee_paid BOOLEAN DEFAULT FALSE,
  fee_receipt_url TEXT,

  -- Status
  status TEXT DEFAULT 'preparing', -- preparing, submitted, offer_received, rejected, withdrawn

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OFFER LETTERS
-- ============================================================

CREATE TABLE offer_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_application_id UUID NOT NULL REFERENCES university_applications(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id),
  student_id UUID NOT NULL REFERENCES profiles(id),

  outcome offer_outcome NOT NULL,
  offer_status offer_status DEFAULT 'pending_review',

  offer_letter_url TEXT,
  conditions TEXT, -- for conditional offers
  conditions_met BOOLEAN DEFAULT FALSE,
  conditions_doc_url TEXT,

  offer_deadline DATE,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TUITION DEPOSIT & CAS/I-20
-- ============================================================

CREATE TABLE tuition_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  university_application_id UUID REFERENCES university_applications(id),
  student_id UUID NOT NULL REFERENCES profiles(id),

  amount NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  payment_method TEXT, -- Stripe, Flutterwave, PayPal, bank transfer
  payment_status payment_status DEFAULT 'pending',

  deposit_receipt_url TEXT,
  financial_proof_url TEXT,
  sponsorship_doc_url TEXT,
  medical_doc_url TEXT,

  -- CAS / I-20 / CoE
  cas_i20_type TEXT, -- CAS, I-20, CoE
  cas_i20_number TEXT,
  cas_i20_url TEXT,
  cas_i20_requested_at TIMESTAMPTZ,
  cas_i20_received_at TIMESTAMPTZ,

  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISA APPLICATIONS
-- ============================================================

CREATE TABLE visa_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),
  visa_officer_id UUID REFERENCES profiles(id),

  visa_type TEXT, -- Student Visa, Tier 4, F-1, etc.
  destination_country TEXT,
  status visa_status DEFAULT 'not_started',

  -- Biometrics
  biometrics_booked_at TIMESTAMPTZ,
  biometrics_appointment_url TEXT,

  -- Submission
  submitted_at TIMESTAMPTZ,
  visa_reference_number TEXT,

  -- Interview
  mock_interview_scheduled_at TIMESTAMPTZ,
  mock_interview_notes TEXT,
  interview_date TIMESTAMPTZ,

  -- Outcome
  decision TEXT, -- approved, rejected, additional_docs_required
  decision_date DATE,
  visa_doc_url TEXT,

  -- Checklist
  checklist JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRE-DEPARTURE
-- ============================================================

CREATE TABLE pre_departure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),

  -- Accommodation
  accommodation_type TEXT, -- university hall, private, homestay
  accommodation_address TEXT,
  accommodation_confirmed BOOLEAN DEFAULT FALSE,
  accommodation_doc_url TEXT,

  -- Travel
  flight_itinerary_url TEXT,
  departure_date DATE,
  arrival_date DATE,
  airport_pickup_required BOOLEAN DEFAULT FALSE,
  airport_pickup_arranged BOOLEAN DEFAULT FALSE,

  -- Briefing
  briefing_attended BOOLEAN DEFAULT FALSE,
  briefing_date TIMESTAMPTZ,
  webinar_link TEXT,

  -- Checklist
  travel_checklist JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEPARTURE & ENROLLMENT CONFIRMATION
-- ============================================================

CREATE TABLE enrollment_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),

  boarding_pass_url TEXT,
  arrival_confirmation_url TEXT,
  enrollment_confirmation_url TEXT,
  institution_student_id TEXT,

  arrived_at DATE,
  enrolled_at DATE,

  -- Alumni & referral
  converted_to_alumni BOOLEAN DEFAULT FALSE,
  satisfaction_survey_completed BOOLEAN DEFAULT FALSE,
  referral_code TEXT,

  confirmed_by UUID REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (Counselor <-> Student)
-- ============================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS (general payment log)
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  application_id UUID REFERENCES applications(id),
  payment_type TEXT NOT NULL, -- application_fee, tuition_deposit, visa_fee, service_fee
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT, -- Stripe, Flutterwave, PayPal
  provider_reference TEXT,
  status payment_status DEFAULT 'pending',
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_applications_student ON applications(student_id);
CREATE INDEX idx_applications_stage ON applications(current_stage);
CREATE INDEX idx_documents_application ON documents(application_id);
CREATE INDEX idx_documents_student ON documents(student_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, is_read);
CREATE INDEX idx_university_apps_application ON university_applications(application_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own, admins/counselors can read all
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Staff can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'counselor', 'admissions', 'visa_officer')
    )
  );

-- Students can only see their own application
CREATE POLICY "Students view own applications" ON applications
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'counselor', 'admissions', 'visa_officer')
    )
  );

-- Students can only see their own documents
CREATE POLICY "Students view own documents" ON documents
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'counselor', 'admissions', 'visa_officer')
    )
  );

-- Notifications: users see only their own
CREATE POLICY "Users view own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- Messages: sender or recipient
CREATE POLICY "Users view own messages" ON messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Payments: students see own, staff see all
CREATE POLICY "Students view own payments" ON payments
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'admissions')
    )
  );
