const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

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

    // Notify student
    const outcomeMessages = {
      unconditional: 'Congratulations! You have received an unconditional offer',
      conditional: 'You have received a conditional offer',
      waitlisted: 'You have been waitlisted',
      rejected: 'Unfortunately, your application was not successful',
    };

    await supabase.from('notifications').insert({
      user_id: student_id,
      type: outcome === 'unconditional' ? 'success' : outcome === 'rejected' ? 'warning' : 'info',
      title: 'Offer Letter Received',
      message: outcomeMessages[outcome],
      link: '/dashboard/offers',
    });

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
