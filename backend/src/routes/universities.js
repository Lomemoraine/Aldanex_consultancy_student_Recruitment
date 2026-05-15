const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/universities/:applicationId - list university applications
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('university_applications')
      .select('*, offer_letters(*)')
      .eq('application_id', req.params.applicationId)
      .order('created_at');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities - add a university application
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      application_id, university_name, university_country,
      course_name, intake, application_fee
    } = req.body;

    const studentId = req.user.profile?.id || req.user.id;

    // Validate application_id
    if (!application_id || application_id.trim() === '') {
      // Try to find the application automatically
      const { data: app } = await supabase
        .from('applications')
        .select('id')
        .eq('student_id', studentId)
        .limit(1)
        .single();

      if (!app) {
        return res.status(400).json({ error: 'No application found. Please refresh and try again.' });
      }

      const { data, error } = await supabase
        .from('university_applications')
        .insert({
          application_id: app.id,
          student_id: studentId,
          university_name,
          university_country,
          course_name,
          intake,
          application_fee,
          status: 'preparing',
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    const { data, error } = await supabase
      .from('university_applications')
      .insert({
        application_id,
        student_id: studentId,
        university_name,
        university_country,
        course_name,
        intake,
        application_fee,
        status: 'preparing',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /universities error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/universities/:id/submit - mark as submitted
router.patch('/:id/submit', authenticate, requireRole('admin', 'admissions'), async (req, res) => {
  try {
    const { reference_number, submitted_at, sop_url, application_form_url } = req.body;

    const { data, error } = await supabase
      .from('university_applications')
      .update({
        status: 'submitted',
        reference_number,
        submitted_at: submitted_at || new Date().toISOString(),
        sop_url,
        application_form_url,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify student
    await supabase.from('notifications').insert({
      user_id: data.student_id,
      type: 'success',
      title: 'Application Submitted',
      message: `Your application to ${data.university_name} has been submitted. Reference: ${reference_number}`,
      link: '/dashboard/universities',
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
