const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSMS, smsTemplates } = require('../lib/sms');

// POST /api/offers - record an offer letter
router.post('/', authenticate, requireRole('admin', 'admissions', 'counselor'), async (req, res) => {
  try {
    const {
      university_application_id, application_id, student_id,
      outcome, offer_letter_url, conditions, offer_deadline
    } = req.body;

    const { data, error } = await supabase
      .from('offer_letters')
      .insert({
        university_application_id,
        application_id,
        student_id,
        outcome,
        offer_letter_url,
        conditions,
        offer_deadline,
        offer_status: 'pending_review',
      })
      .select()
      .single();

    if (error) throw error;

    // Update university application status
    await supabase
      .from('university_applications')
      .update({ status: 'offer_received' })
      .eq('id', university_application_id);

    // Update main application stage to offer_letter
    await supabase
      .from('applications')
      .update({ current_stage: 'offer_letter' })
      .eq('id', application_id);

    const outcomeMessages = {
      unconditional: 'Congratulations! You have received an unconditional offer.',
      conditional:   'You have received a conditional offer. Please check the conditions.',
      waitlisted:    'You have been waitlisted at this university.',
      rejected:      'Unfortunately, your application was not successful at this university.',
    };

    // Notify student via in-app + SMS
    await supabase.from('notifications').insert({
      user_id: student_id,
      type: outcome === 'unconditional' ? 'success' : outcome === 'rejected' ? 'warning' : 'info',
      title: 'Offer Letter Received',
      message: outcomeMessages[outcome] || 'You have received an update on your application.',
      link: '/dashboard/universities',
    });

    // SMS notification
    try {
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', student_id)
        .single();

      if (student?.phone) {
        // Get university name
        const { data: uniApp } = await supabase
          .from('university_applications')
          .select('university_name')
          .eq('id', university_application_id)
          .single();

        const smsBody = smsTemplates.offerReceived(
          student.full_name.split(' ')[0],
          uniApp?.university_name || 'the university',
          outcome
        );
        sendSMS(student.phone, smsBody).catch(() => {});
      }
    } catch (smsErr) {
      console.error('Offer SMS failed:', smsErr.message);
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/offers/:id/respond - student accepts or declines offer
router.patch('/:id/respond', authenticate, async (req, res) => {
  try {
    const { decision } = req.body; // 'accepted' or 'declined'

    if (!['accepted', 'declined'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be accepted or declined' });
    }

    const update = {
      offer_status: decision,
      [`${decision}_at`]: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('offer_letters')
      .update(update)
      .eq('id', req.params.id)
      .select('*, university_application_id, application_id')
      .single();

    if (error) throw error;

    // If accepted, notify admissions team and update application stage
    if (decision === 'accepted') {
      const { data: uniApp } = await supabase
        .from('university_applications')
        .select('university_name, student_id, application_id')
        .eq('id', data.university_application_id)
        .single();

      const { data: student } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', uniApp?.student_id)
        .single();

      // Get assigned counselor from the main application
      const { data: mainApp } = await supabase
        .from('applications')
        .select('assigned_counselor_id')
        .eq('id', data.application_id)
        .single();

      // Notify ALL admin/admissions staff + the specific assigned counselor
      const { data: adminStaff } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'admissions']);

      const recipientIds = new Set((adminStaff || []).map(a => a.id));
      if (mainApp?.assigned_counselor_id) {
        recipientIds.add(mainApp.assigned_counselor_id);
      }

      if (recipientIds.size > 0) {
        const notificationPayload = Array.from(recipientIds).map(uid => ({
          user_id: uid,
          type: 'success',
          title: '🎓 Student Accepted Offer',
          message: `${student?.full_name || 'A student'} has accepted the offer from ${uniApp?.university_name || 'a university'}. Next step: proceed with visa application.`,
          link: '/admin/applications'
        }));

        await supabase.from('notifications').insert(notificationPayload);
      }

      // Update application stage to tuition_deposit (student accepted offer, now needs to pay deposit)
      await supabase
        .from('applications')
        .update({ current_stage: 'tuition_deposit' })
        .eq('id', data.application_id);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
