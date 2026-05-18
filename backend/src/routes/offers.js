const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSMS, smsTemplates } = require('../lib/sms');

// POST /api/offers - record an offer letter
router.post('/', authenticate, requireRole('admin', 'admissions'), async (req, res) => {
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
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
