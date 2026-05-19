const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');
const { sendSMS, smsTemplates } = require('../lib/sms');

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

    const { profile } = req.user;

    // If counselor, verify they are assigned to this student
    if (profile.role === 'counselor') {
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('assigned_counselor_id')
        .eq('id', application_id)
        .single();

      if (appError) {
        return res.status(404).json({ error: 'Application not found' });
      }

      if (application.assigned_counselor_id !== profile.id) {
        return res.status(403).json({ error: 'You are not assigned to this student' });
      }
    }

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

    // Notify student via in-app + email + SMS
    await supabase.from('notifications').insert({
      user_id: student_id,
      type: 'info',
      title: 'Counseling Session Scheduled',
      message: `A ${session_type} session has been scheduled for ${new Date(scheduled_at).toLocaleString()} via ${platform}.`,
      link: '/dashboard/messages',
    });

    // Email + SMS
    try {
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', student_id)
        .single();

      if (student) {
        // Email
        const { subject, html } = templates.sessionScheduledEmail(
          student.full_name, session_type, platform, scheduled_at, meeting_link
        );
        await sendEmail({ to: student.email, subject, html });

        // SMS
        if (student.phone) {
          const dateStr = new Date(scheduled_at).toLocaleString([], {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          const smsBody = smsTemplates.sessionScheduled(
            student.full_name.split(' ')[0], platform, dateStr
          );
          sendSMS(student.phone, smsBody).catch(() => {});
        }
      }
    } catch (notifErr) {
      console.error('Session notification failed:', notifErr.message);
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
