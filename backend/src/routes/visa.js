const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSMS, smsTemplates } = require('../lib/sms');

// GET /api/visa/:applicationId
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('visa_applications')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/visa - create visa application
router.post('/', authenticate, requireRole('admin', 'visa_officer', 'admissions'), async (req, res) => {
  try {
    const { application_id, student_id, visa_type, destination_country } = req.body;

    const { data, error } = await supabase
      .from('visa_applications')
      .insert({
        application_id,
        student_id,
        visa_officer_id: req.user.profile.id,
        visa_type,
        destination_country,
        status: 'not_started',
        checklist: {
          passport: false,
          photos: false,
          bank_statement: false,
          acceptance_letter: false,
          cas_i20: false,
          accommodation_proof: false,
          travel_insurance: false,
          visa_form: false,
        },
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: student_id,
      type: 'action_required',
      title: 'Visa Application Started',
      message: `Your ${visa_type} visa application process has begun. Please upload required documents.`,
      link: '/dashboard/visa',
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/visa/:id - update visa application
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const allowedFields = [
      'status', 'biometrics_booked_at', 'biometrics_appointment_url',
      'submitted_at', 'visa_reference_number', 'mock_interview_scheduled_at',
      'mock_interview_notes', 'interview_date', 'decision', 'decision_date',
      'visa_doc_url', 'checklist'
    ];

    const update = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) update[f] = req.body[f];
    });

    const { data, error } = await supabase
      .from('visa_applications')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify student on decision
    if (update.decision) {
      const isApproved = update.decision === 'approved';
      await supabase.from('notifications').insert({
        user_id: data.student_id,
        type: isApproved ? 'success' : 'warning',
        title: `Visa ${isApproved ? 'Approved' : 'Decision Received'}`,
        message: `Your visa application decision: ${update.decision.toUpperCase()}`,
        link: '/dashboard/visa',
      });

      // SMS for visa decision
      try {
        const { data: student } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', data.student_id)
          .single();

        if (student?.phone && isApproved) {
          const smsBody = smsTemplates.visaApproved(student.full_name.split(' ')[0]);
          sendSMS(student.phone, smsBody).catch(() => {});
        } else if (student?.phone && !isApproved) {
          const smsBody = `Hi ${student.full_name.split(' ')[0]}, your visa application decision has been received: ${update.decision.toUpperCase()}. Log in for details: ${process.env.FRONTEND_URL}/dashboard/visa`;
          sendSMS(student.phone, smsBody).catch(() => {});
        }
      } catch (smsErr) {
        console.error('Visa SMS failed:', smsErr.message);
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
