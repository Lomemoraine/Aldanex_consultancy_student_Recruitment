const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/students - list all students (admin/counselor only)
router.get('/', authenticate, requireRole('admin', 'counselor', 'admissions'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const { profile } = req.user;

    // Counselors only see students assigned to them
    if (profile.role === 'counselor') {
      // Get applications assigned to this counselor
      let appQuery = supabase
        .from('applications')
        .select('student_id', { count: 'exact' })
        .eq('assigned_counselor_id', profile.id);

      const { data: apps, error: appError } = await appQuery;
      if (appError) throw appError;

      const studentIds = apps.map(app => app.student_id);

      if (studentIds.length === 0) {
        return res.json({ data: [], total: 0, page: Number(page), limit: Number(limit) });
      }

      // Fetch student profiles for assigned students
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, student_id, nationality, preferred_study_destination, phone, created_at', { count: 'exact' })
        .in('id', studentIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,student_id.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return res.json({ data: data || [], total: count || 0, page: Number(page), limit: Number(limit) });
    }

    // Admin and admissions see all students
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, student_id, nationality, preferred_study_destination, phone, created_at', { count: 'exact' })
      .eq('role', 'student')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,student_id.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data: data || [], total: count || 0, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('GET /students error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id - get student details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;

    // Students can only view their own profile
    if (req.user.profile?.role === 'student' && userId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Also fetch student profile separately
    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', req.params.id)
      .single();

    res.json({ ...data, student_profile: studentProfile });
  } catch (err) {
    console.error('GET /students/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/students/:id/profile - update student profile
router.put('/:id/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;

    // Students can only update their own profile
    if (req.user.profile?.role === 'student' && userId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profileFields = [
      'date_of_birth', 'gender', 'address', 'city', 'country',
      'passport_number', 'passport_expiry', 'passport_country',
      'highest_qualification', 'qualification_level', 'institution_attended',
      'graduation_year', 'gpa', 'english_test_type', 'english_test_score',
      'english_test_date', 'preferred_course', 'preferred_intake', 'budget_range',
      'preferred_countries', 'preferred_universities', 'sponsorship_type',
      'employment_background', 'is_submitted'
    ];

    const updateData = {};
    profileFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    // Check if student_profile exists first
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', req.params.id)
      .limit(1);

    let data, error;

    if (existing && existing.length > 0) {
      // Update existing
      ({ data, error } = await supabase
        .from('student_profiles')
        .update(updateData)
        .eq('user_id', req.params.id)
        .select()
        .single());
    } else {
      // Ensure profiles row exists before inserting student_profiles
      const { data: profileExists } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', req.params.id)
        .limit(1);

      if (!profileExists || profileExists.length === 0) {
        // Auto-create the profile row using service role
        const { error: profileCreateError } = await supabase
          .from('profiles')
          .insert({
            id: req.params.id,
            role: 'student',
            full_name: req.user.user_metadata?.full_name || 'Student',
            email: req.user.email || '',
          });

        if (profileCreateError) {
          console.error('Failed to create profile row:', profileCreateError.message);
          return res.status(500).json({ error: 'Could not create profile. Please log out and log back in.' });
        }
      }

      // Insert new student_profile
      ({ data, error } = await supabase
        .from('student_profiles')
        .insert({ user_id: req.params.id, ...updateData })
        .select()
        .single());
    }

    if (error) throw error;

    // Auto-advance stage logic based on profile completeness
    const studentId = req.params.id;

    // Count how many key fields are filled
    const keyFields = [
      'date_of_birth', 'gender', 'passport_number', 'highest_qualification',
      'qualification_level', 'english_test_type', 'preferred_course',
      'preferred_intake', 'budget_range', 'sponsorship_type'
    ];
    const filledCount = keyFields.filter(f => data?.[f] || updateData[f]).length;
    const completionPct = Math.round((filledCount / keyFields.length) * 100)

    // Fetch current application stage
    const { data: app } = await supabase
      .from('applications')
      .select('id, current_stage')
      .eq('student_id', studentId)
      .limit(1)
      .single();

    if (app) {
      // Move from registered → profile_completion as soon as any data is saved
      if (app.current_stage === 'registered') {
        await supabase
          .from('applications')
          .update({ current_stage: 'profile_completion' })
          .eq('id', app.id);
      }

      // Move from profile_completion → document_upload when profile is ≥70% complete
      if (app.current_stage === 'profile_completion' && completionPct >= 70) {
        await supabase
          .from('applications')
          .update({ current_stage: 'document_upload' })
          .eq('id', app.id);
      }
    }

    res.json({ ...data, completion_pct: completionPct });
  } catch (err) {
    console.error('PUT /students/:id/profile error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
