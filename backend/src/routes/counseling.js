const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');
const { sendSMS, smsTemplates } = require('../lib/sms');

// GET /api/counseling/assessments - get all assessments (counselor sees assigned only)
router.get('/assessments', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;
    const userRole = req.user.profile?.role || req.user.role;

    let query = supabase
      .from('applications')
      .select(`
        id,
        student_id,
        current_stage,
        assigned_counselor_id,
        profiles!applications_student_id_fkey(id, full_name, email, student_id, nationality, preferred_study_destination)
      `)
      .in('current_stage', ['initial_assessment', 'counseling']);

    // Filter for counselors
    if (userRole === 'counselor') {
      query = query.eq('assigned_counselor_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Assessment query error:', error);
      throw error;
    }

    // Try to get assessment fields if they exist
    const enrichedData = await Promise.all((data || []).map(async (app) => {
      try {
        const { data: fullApp } = await supabase
          .from('applications')
          .select('assessment_status, assessment_score, assessment_notes, counselor_recommendations, assessment_started_at, assessment_completed_at, academic_evaluation, financial_evaluation, english_proficiency_evaluation, recommended_countries, recommended_universities')
          .eq('id', app.id)
          .single();
        
        return { ...app, ...(fullApp || {}) };
      } catch {
        // If assessment fields don't exist, return app with defaults
        return {
          ...app,
          assessment_status: 'not_started',
          assessment_score: null,
          assessment_notes: null,
          counselor_recommendations: null,
          assessment_started_at: null,
          assessment_completed_at: null,
        };
      }
    }));

    res.json(enrichedData);
  } catch (err) {
    console.error('Assessment endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/counseling/assessment/start - start assessment for a student
router.post('/assessment/start', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const { application_id } = req.body;
    const counselorId = req.user.profile?.id || req.user.id;

    const { data, error } = await supabase
      .from('applications')
      .update({
        assessment_status: 'in_progress',
        assessment_started_at: new Date().toISOString(),
        assigned_counselor_id: counselorId,
      })
      .eq('id', application_id)
      .select('*, profiles!applications_student_id_fkey(id, full_name, email)')
      .single();

    if (error) throw error;

    // Notify student
    await supabase.from('notifications').insert({
      user_id: data.student_id,
      type: 'info',
      title: 'Assessment In Progress',
      message: 'Your counselor is reviewing your profile and documents. You will be notified once the assessment is complete.',
      link: '/dashboard',
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/counseling/assessment/:applicationId - update assessment
router.patch('/assessment/:applicationId', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const {
      assessment_score,
      assessment_notes,
      academic_evaluation,
      financial_evaluation,
      english_proficiency_evaluation,
      recommended_countries,
      recommended_universities,
    } = req.body;

    const { data, error } = await supabase
      .from('applications')
      .update({
        assessment_score,
        assessment_notes,
        academic_evaluation,
        financial_evaluation,
        english_proficiency_evaluation,
        recommended_countries,
        recommended_universities,
      })
      .eq('id', req.params.applicationId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/counseling/assessment/complete - complete assessment and schedule session
router.post('/assessment/complete', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const { application_id, schedule_session, session_details } = req.body;

    // Mark assessment as complete
    const { data: application, error: appError } = await supabase
      .from('applications')
      .update({
        assessment_status: 'completed',
        assessment_completed_at: new Date().toISOString(),
      })
      .eq('id', application_id)
      .select('*, profiles!applications_student_id_fkey(id, full_name, email, phone)')
      .single();

    if (appError) throw appError;

    // Notify student
    await supabase.from('notifications').insert({
      user_id: application.student_id,
      type: 'success',
      title: 'Assessment Complete',
      message: schedule_session 
        ? 'Your assessment is complete! A counseling session has been scheduled to discuss your options.'
        : 'Your assessment is complete! Your counselor will contact you soon to discuss next steps.',
      link: '/dashboard',
    });

    // Schedule session if requested
    let session = null;
    if (schedule_session && session_details) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('counseling_sessions')
        .insert({
          application_id,
          student_id: application.student_id,
          counselor_id: req.user.profile.id,
          session_type: session_details.session_type || 'virtual',
          platform: session_details.platform || 'Zoom',
          meeting_link: session_details.meeting_link,
          scheduled_at: session_details.scheduled_at,
          duration_minutes: session_details.duration_minutes || 60,
          status: 'scheduled',
          session_purpose: 'assessment_discussion',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      session = sessionData;

      // Send session notification
      await supabase.from('notifications').insert({
        user_id: application.student_id,
        type: 'info',
        title: 'Counseling Session Scheduled',
        message: `A counseling session has been scheduled for ${new Date(session_details.scheduled_at).toLocaleString()} to discuss your assessment results.`,
        link: '/dashboard',
      });

      // Email + SMS
      try {
        const student = application.profiles;
        if (student) {
          // Email
          const { subject, html } = templates.sessionScheduledEmail(
            student.full_name,
            session_details.session_type || 'virtual',
            session_details.platform || 'Zoom',
            session_details.scheduled_at,
            session_details.meeting_link
          );
          await sendEmail({ to: student.email, subject, html });

          // SMS
          if (student.phone) {
            const dateStr = new Date(session_details.scheduled_at).toLocaleString([], {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
            const smsBody = smsTemplates.sessionScheduled(
              student.full_name.split(' ')[0],
              session_details.platform || 'Zoom',
              dateStr
            );
            sendSMS(student.phone, smsBody).catch(() => {});
          }
        }
      } catch (notifErr) {
        console.error('Session notification failed:', notifErr.message);
      }
    }

    res.json({ application, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// GET /api/counseling/session/:id - get single session details
router.get('/session/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('counseling_sessions')
      .select(`
        *,
        counselor:profiles!counseling_sessions_counselor_id_fkey(id, full_name, email),
        student:profiles!counseling_sessions_student_id_fkey(id, full_name, email, student_id)
      `)
      .eq('id', req.params.id)
      .single();

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
      console.log('Fetching student data for notifications...');
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', student_id)
        .single();

      console.log('Student data:', student);

      if (student) {
        // Email
        console.log('Preparing to send email to:', student.email);
        const { subject, html } = templates.sessionScheduledEmail(
          student.full_name, session_type, platform, scheduled_at, meeting_link
        );
        
        console.log('Email subject:', subject);
        console.log('Calling sendEmail...');
        
        const emailResult = await sendEmail({ to: student.email, subject, html });
        console.log('Email sent successfully:', emailResult);

        // SMS
        if (student.phone) {
          console.log('Sending SMS to:', student.phone);
          const dateStr = new Date(scheduled_at).toLocaleString([], {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          const smsBody = smsTemplates.sessionScheduled(
            student.full_name.split(' ')[0], platform, dateStr
          );
          sendSMS(student.phone, smsBody).catch((smsErr) => {
            console.error('SMS sending failed:', smsErr);
          });
        } else {
          console.log('No phone number for student, skipping SMS');
        }
      } else {
        console.error('Student data not found for id:', student_id);
      }
    } catch (notifErr) {
      console.error('Session notification failed:', notifErr);
      console.error('Error details:', notifErr.message);
      console.error('Error stack:', notifErr.stack);
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/counseling/:id - update session (add notes, change status, add recommendations)
router.patch('/:id', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const { status, meeting_notes, recommendations, counselor_recommendations } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (meeting_notes) updateData.meeting_notes = meeting_notes;
    if (recommendations) updateData.recommendations = recommendations;

    const { data: session, error } = await supabase
      .from('counseling_sessions')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, application_id, student_id')
      .single();

    if (error) throw error;

    // If recommendations provided and session completed, update application
    if (counselor_recommendations && status === 'completed') {
      await supabase
        .from('applications')
        .update({ counselor_recommendations })
        .eq('id', session.application_id);

      // Notify student about recommendations
      await supabase.from('notifications').insert({
        user_id: session.student_id,
        type: 'success',
        title: 'Counseling Recommendations Available',
        message: 'Your counselor has added recommendations from your session. View them in your dashboard.',
        link: '/dashboard',
      });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
