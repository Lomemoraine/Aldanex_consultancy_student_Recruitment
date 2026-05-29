const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/universities/recommendations - get counselor recommendations for student
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const studentId = req.user.profile?.id || req.user.id;

    const { data, error } = await supabase
      .from('applications')
      .select('recommended_universities, counselor_recommendations, assessment_score, assessment_status')
      .eq('student_id', studentId)
      .single();

    if (error) throw error;

    res.json({
      recommended_universities: data?.recommended_universities || [],
      counselor_recommendations: data?.counselor_recommendations || '',
      assessment_score: data?.assessment_score || null,
      assessment_status: data?.assessment_status || 'not_started'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/select - student selects universities from recommendations
router.post('/select', authenticate, async (req, res) => {
  try {
    const { selected_universities } = req.body;
    const studentId = req.user.profile?.id || req.user.id;

    if (!selected_universities || !Array.isArray(selected_universities) || selected_universities.length === 0) {
      return res.status(400).json({ error: 'Please select at least one university' });
    }

    if (selected_universities.length > 5) {
      return res.status(400).json({ error: 'You can select a maximum of 5 universities' });
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('student_id', studentId)
      .single();

    if (appError) throw appError;

    const records = selected_universities.map(uni => ({
      application_id: application.id,
      student_id: studentId,
      university_name: uni.university_name,
      university_country: uni.university_country || '',
      course_name: uni.course_name || '',
      intake: uni.intake || '',
      application_fee: uni.application_fee || null,
      status: 'selected',
      selected_by_student: true,
      selected_by_student_at: new Date().toISOString(),
      preparation_status: 'not_started'
    }));

    const { data, error } = await supabase
      .from('university_applications')
      .insert(records)
      .select();

    if (error) throw error;

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'admissions']);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'info',
        title: 'New University Selections',
        message: `A student has selected ${selected_universities.length} universities for application preparation.`,
        link: '/admin/universities/prepare'
      }));
      await supabase.from('notifications').insert(notifications);
    }

    await supabase
      .from('applications')
      .update({ current_stage: 'university_selection' })
      .eq('id', application.id);

    res.status(201).json(data);
  } catch (err) {
    console.error('POST /universities/select error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/selected/all - get all selected universities (for admissions team)
// IMPORTANT: This route must be defined BEFORE /:applicationId to avoid route conflict
router.get('/selected/all', authenticate, requireRole('admin', 'admissions', 'counselor'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('university_applications')
      .select(`
        *,
        offer_letters(*),
        application:applications!university_applications_application_id_fkey(
          id,
          current_stage,
          student:profiles!applications_student_id_fkey(id, full_name, email, student_id)
        )
      `)
      .eq('selected_by_student', true)
      .in('status', [
        'selected', 'preparing', 'ready_for_approval', 'changes_requested',
        'approved', 'payment_pending', 'payment_complete',
        'submitted', 'offer_received', 'rejected'
      ])
      .order('selected_by_student_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/universities/pending-approval/:applicationId - get apps ready for student approval
router.get('/pending-approval/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('university_applications')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .eq('status', 'ready_for_approval')
      .order('created_at');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    if (!application_id || application_id.trim() === '') {
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

// PATCH /api/universities/:id/prepare - update preparation status and materials
router.patch('/:id/prepare', authenticate, requireRole('admin', 'admissions', 'counselor'), async (req, res) => {
  try {
    const {
      preparation_status,
      sop_url,
      application_form_url,
      checklist,
      application_fee
    } = req.body;

    const preparedBy = req.user.profile?.id || req.user.id;
    const updateData = { prepared_by: preparedBy };

    if (preparation_status) {
      updateData.preparation_status = preparation_status;
      if (preparation_status === 'in_progress' && !req.body.preparation_started_at) {
        updateData.preparation_started_at = new Date().toISOString();
      }
      if (preparation_status === 'approved') {
        updateData.preparation_completed_at = new Date().toISOString();
      }
    }

    if (sop_url) updateData.sop_url = sop_url;
    if (application_form_url) updateData.application_form_url = application_form_url;
    if (checklist) updateData.checklist = checklist;
    if (application_fee !== undefined) updateData.application_fee = application_fee;

    if (!req.body.keep_status) {
      updateData.status = 'preparing';
    }

    const { data, error } = await supabase
      .from('university_applications')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/:id/ready-for-approval - mark ready for student approval
router.post('/:id/ready-for-approval', authenticate, requireRole('admin', 'admissions', 'counselor'), async (req, res) => {
  try {
    const { application_fee } = req.body;

    const { data, error } = await supabase
      .from('university_applications')
      .update({
        status: 'ready_for_approval',
        preparation_status: 'ready_for_review',
        preparation_completed_at: new Date().toISOString(),
        application_fee: application_fee || null
      })
      .eq('id', req.params.id)
      .select('*, application_id')
      .single();

    if (error) throw error;

    const { data: app } = await supabase
      .from('applications')
      .select('student_id, profiles!applications_student_id_fkey(full_name)')
      .eq('id', data.application_id)
      .single();

    if (app) {
      await supabase.from('notifications').insert({
        user_id: app.student_id,
        type: 'info',
        title: 'Application Ready for Review',
        message: `Your application to ${data.university_name} is ready for your review and approval.`,
        link: '/dashboard/universities/approve'
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/:id/approve - student approves application
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const { signature } = req.body;
    const studentId = req.user.profile?.id || req.user.id;

    const { data: app, error: checkError } = await supabase
      .from('university_applications')
      .select('student_id, application_fee')
      .eq('id', req.params.id)
      .single();

    if (checkError) throw checkError;

    if (app.student_id !== studentId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const requiresPayment = app.application_fee && app.application_fee > 0;
    const newStatus = requiresPayment ? 'payment_pending' : 'approved';

    const { data, error } = await supabase
      .from('university_applications')
      .update({
        student_approved: true,
        student_approved_at: new Date().toISOString(),
        student_signature: signature || null,
        status: newStatus,
        preparation_status: 'approved'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (requiresPayment) {
      await supabase.from('notifications').insert({
        user_id: studentId,
        type: 'info',
        title: 'Payment Required',
        message: `Please pay the application fee for ${data.university_name} to proceed with submission.`,
        link: '/dashboard/universities/payment'
      });
    }

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'admissions']);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'success',
        title: 'Application Approved by Student',
        message: `Student approved application to ${data.university_name}. ${requiresPayment ? 'Awaiting payment.' : 'Ready for submission.'}`,
        link: '/admin/universities/prepare'
      }));
      await supabase.from('notifications').insert(notifications);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/:id/request-changes - student requests changes
router.post('/:id/request-changes', authenticate, async (req, res) => {
  try {
    const { comments } = req.body;
    const studentId = req.user.profile?.id || req.user.id;

    if (!comments || comments.trim() === '') {
      return res.status(400).json({ error: 'Please provide comments about the changes needed' });
    }

    const { data: app, error: checkError } = await supabase
      .from('university_applications')
      .select('student_id')
      .eq('id', req.params.id)
      .single();

    if (checkError) throw checkError;

    if (app.student_id !== studentId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('university_applications')
      .update({
        status: 'changes_requested',
        preparation_status: 'changes_requested',
        student_comments: comments,
        student_approved: false
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'admissions']);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'warning',
        title: 'Changes Requested',
        message: `Student requested changes to ${data.university_name} application.`,
        link: '/admin/universities/prepare'
      }));
      await supabase.from('notifications').insert(notifications);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universities/:id/payment - record fee payment
router.post('/:id/payment', authenticate, async (req, res) => {
  try {
    const { payment_reference, fee_paid_at } = req.body;
    const studentId = req.user.profile?.id || req.user.id;

    const { data: app, error: checkError } = await supabase
      .from('university_applications')
      .select('student_id')
      .eq('id', req.params.id)
      .single();

    if (checkError) throw checkError;

    if (app.student_id !== studentId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('university_applications')
      .update({
        fee_paid: true,
        fee_paid_at: fee_paid_at || new Date().toISOString(),
        payment_reference: payment_reference || null,
        status: 'payment_complete'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'admissions']);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'success',
        title: 'Application Fee Paid',
        message: `Student paid fee for ${data.university_name} application. Ready for submission.`,
        link: '/admin/universities/prepare'
      }));
      await supabase.from('notifications').insert(notifications);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/universities/:id/submit - mark as submitted
router.patch('/:id/submit', authenticate, requireRole('admin', 'admissions', 'counselor'), async (req, res) => {
  try {
    const { reference_number, submitted_at, sop_url, application_form_url } = req.body;
    const submittedBy = req.user.profile?.id || req.user.id;

    const { data, error } = await supabase
      .from('university_applications')
      .update({
        status: 'submitted',
        reference_number,
        submitted_at: submitted_at || new Date().toISOString(),
        submitted_by: submittedBy,
        sop_url,
        application_form_url,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('applications')
      .update({ current_stage: 'application_submission' })
      .eq('id', data.application_id);

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

// PATCH /api/universities/:id/status - update application status (admissions only)
router.patch('/:id/status', authenticate, requireRole('admin', 'admissions', 'counselor'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const allowedStatuses = ['offer_received', 'rejected', 'withdrawn'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('university_applications')
      .update({ status })
      .eq('id', req.params.id)
      .select('*, application_id')
      .single();

    if (error) throw error;

    const { data: app } = await supabase
      .from('applications')
      .select('student_id')
      .eq('id', data.application_id)
      .single();

    if (app) {
      let title = 'Application Status Updated';
      let message = `Your application to ${data.university_name} status has been updated.`;
      let type = 'info';

      if (status === 'offer_received') {
        title = 'Offer Received!';
        message = `Congratulations! You have received an offer from ${data.university_name}!`;
        type = 'success';
      } else if (status === 'rejected') {
        title = 'Application Update';
        message = `Your application to ${data.university_name} was not successful this time.`;
        type = 'warning';
      }

      await supabase.from('notifications').insert({
        user_id: app.student_id,
        type,
        title,
        message,
        link: '/dashboard/universities'
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;