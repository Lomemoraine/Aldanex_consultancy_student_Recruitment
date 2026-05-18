const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');
const { sendSMS, smsTemplates } = require('../lib/sms');

// GET /api/applications - list applications (admin/counselor sees all, student sees own)
router.get('/', authenticate, async (req, res) => {
  try {
    const { profile } = req.user;

    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    let query = supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (profile.role === 'student') {
      query = query.eq('student_id', profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /applications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/:id - get single application with all related data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        documents(*),
        counseling_sessions(*),
        university_applications(*),
        offer_letters(*),
        tuition_deposits(*),
        visa_applications(*),
        pre_departure(*),
        enrollment_confirmations(*),
        stage_history:application_stage_history(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Application not found' });

    if (req.user.profile?.role === 'student' && data.student_id !== req.user.profile.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(data);
  } catch (err) {
    console.error('GET /applications/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:id/stage - advance application stage
router.patch('/:id/stage', authenticate, requireRole('admin', 'counselor', 'admissions', 'visa_officer'), async (req, res) => {
  try {
    const { stage, notes } = req.body;
    const validStages = [
      'registered', 'profile_completion', 'document_upload', 'initial_assessment',
      'counseling', 'university_selection', 'application_submission', 'offer_letter',
      'tuition_deposit', 'visa_application', 'pre_departure', 'enrolled'
    ];

    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    const { data, error } = await supabase
      .from('applications')
      .update({ current_stage: stage, counselor_notes: notes })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Send notification to student
    await supabase.from('notifications').insert({
      user_id: data.student_id,
      type: 'info',
      title: 'Application Stage Updated',
      message: `Your application has moved to: ${stage.replace(/_/g, ' ').toUpperCase()}`,
      link: `/dashboard/application`,
    });

    // Send stage update email + SMS
    try {
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', data.student_id)
        .single();

      if (student) {
        const stageLabel = stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        // Email
        const { subject, html } = templates.stageUpdateEmail(student.full_name, stageLabel, notes);
        await sendEmail({ to: student.email, subject, html });

        // SMS (non-blocking, only if phone number exists)
        if (student.phone) {
          const smsBody = smsTemplates.stageUpdate(student.full_name.split(' ')[0], stageLabel);
          sendSMS(student.phone, smsBody).catch(() => {}); // fire and forget
        }
      }
    } catch (emailErr) {
      console.error('Stage update notifications failed:', emailErr.message);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:id/assign - assign counselor
router.patch('/:id/assign', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { counselor_id, admissions_id } = req.body;
    const update = {};
    if (counselor_id) update.assigned_counselor_id = counselor_id;
    if (admissions_id) update.assigned_admissions_id = admissions_id;

    const { data, error } = await supabase
      .from('applications')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/stats/overview - dashboard stats for admin
router.get('/stats/overview', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('current_stage');

    if (error) throw error;

    const stats = data.reduce((acc, app) => {
      acc[app.current_stage] = (acc[app.current_stage] || 0) + 1;
      return acc;
    }, {});

    res.json({ total: data.length, by_stage: stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
