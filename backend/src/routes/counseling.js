const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');

// GET /api/counseling/:applicationId - get sessions for an application
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('counseling_sessions')
      .select(`
        *,
        counselor:profiles!counseling_sessions_counselor_id_fkey(id, full_name, email)
      `)
      .eq('application_id', req.params.applicationId)
      .order('scheduled_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/counseling - schedule a session
router.post('/', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const {
      application_id, student_id, session_type,
      platform, meeting_link, scheduled_at, duration_minutes
    } = req.body;

    const { data, error } = await supabase
      .from('counseling_sessions')
      .insert({
        application_id,
        student_id,
        counselor_id: req.user.profile.id,
        session_type,
        platform,
        meeting_link,
        scheduled_at,
        duration_minutes,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify student
    await supabase.from('notifications').insert({
      user_id: student_id,
      type: 'info',
      title: 'Counseling Session Scheduled',
      message: `A ${session_type} session has been scheduled for ${new Date(scheduled_at).toLocaleString()} via ${platform}.`,
      link: '/dashboard/sessions',
    });

    // Send session email
    try {
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', student_id)
        .single();

      if (student) {
        const { subject, html } = templates.sessionScheduledEmail(
          student.full_name, session_type, platform, scheduled_at, meeting_link
        );
        await sendEmail({ to: student.email, subject, html });
      }
    } catch (emailErr) {
      console.error('Session email failed:', emailErr.message);
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/counseling/:id - update session (add notes, change status)
router.patch('/:id', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const { status, meeting_notes, recommendations } = req.body;

    const { data, error } = await supabase
      .from('counseling_sessions')
      .update({ status, meeting_notes, recommendations })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
