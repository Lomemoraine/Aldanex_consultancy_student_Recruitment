const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');
const { sendSMS, smsTemplates } = require('../lib/sms');

// GET /api/applications - list applications (admin sees all, counselor sees assigned, student sees own)
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
    } else if (profile.role === 'counselor') {
      // Counselors only see applications assigned to them
      query = query.eq('assigned_counselor_id', profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /applications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/with-students - get applications with student details (for dropdowns)
router.get('/with-students', authenticate, requireRole('admin', 'counselor', 'admissions'), async (req, res) => {
  try {
    const { profile } = req.user;

    let query = supabase
      .from('applications')
      .select(`
        id,
        student_id,
        current_stage,
        assigned_counselor_id,
        assigned_admissions_id,
        created_at,
        student:profiles!applications_student_id_fkey(
          id,
          full_name,
          email,
          student_id,
          nationality,
          preferred_study_destination
        )
      `)
      .order('created_at', { ascending: false });

    // Counselors only see their assigned applications
    if (profile.role === 'counselor') {
      query = query.eq('assigned_counselor_id', profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Format the response to flatten student data
    const formatted = (data || []).map(app => ({
      id: app.id,
      student_id: app.student_id,
      current_stage: app.current_stage,
      assigned_counselor_id: app.assigned_counselor_id,
      assigned_admissions_id: app.assigned_admissions_id,
      created_at: app.created_at,
      student: app.student || {
        id: app.student_id,
        full_name: 'Unknown',
        email: '',
        student_id: null,
        nationality: null,
        preferred_study_destination: null
      }
    }));

    res.json(formatted);
  } catch (err) {
    console.error('GET /applications/with-students error:', err.message);
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

    // Define stages that require document approval
    const stagesRequiringDocumentApproval = [
      'initial_assessment', 'counseling', 'university_selection', 
      'application_submission', 'offer_letter', 'tuition_deposit', 
      'visa_application', 'pre_departure', 'enrolled'
    ];

    // If moving to a stage beyond document_upload, verify all documents are approved
    if (stagesRequiringDocumentApproval.includes(stage)) {
      const { data: documents, error: docError } = await supabase
        .from('documents')
        .select('id, document_name, status')
        .eq('application_id', req.params.id);

      if (docError) throw docError;

      // Check if there are any documents
      if (!documents || documents.length === 0) {
        return res.status(400).json({ 
          error: 'Cannot proceed to this stage',
          message: 'Student must upload documents before proceeding to this stage.',
          stage_blocked: true
        });
      }

      // Check if all documents are approved
      const unapprovedDocs = documents.filter(doc => doc.status !== 'approved');
      
      if (unapprovedDocs.length > 0) {
        const unapprovedNames = unapprovedDocs.map(doc => `${doc.document_name} (${doc.status})`).join(', ');
        return res.status(400).json({ 
          error: 'Cannot proceed to this stage',
          message: `All documents must be approved before proceeding. Unapproved documents: ${unapprovedNames}`,
          unapproved_documents: unapprovedDocs,
          stage_blocked: true
        });
      }
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

    // Notify counselor when assigned to a student
    if (counselor_id) {
      try {
        // Get student details
        const { data: student } = await supabase
          .from('profiles')
          .select('full_name, student_id')
          .eq('id', data.student_id)
          .single();

        // Get counselor details
        const { data: counselor } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', counselor_id)
          .single();

        if (student && counselor) {
          // Create in-app notification for counselor
          await supabase.from('notifications').insert({
            user_id: counselor_id,
            type: 'info',
            title: 'New Student Assigned',
            message: `You have been assigned to ${student.full_name} (${student.student_id || 'ID pending'}).`,
            link: `/admin/applications/${data.id}`,
          });

          // Send email notification to counselor
          const { subject, html } = templates.counselorAssignedEmail(
            counselor.full_name,
            student.full_name,
            student.student_id || 'ID pending',
            data.id
          );
          await sendEmail({ to: counselor.email, subject, html }).catch(err => {
            console.error('Failed to send counselor assignment email:', err.message);
          });
        }
      } catch (notifErr) {
        console.error('Failed to notify counselor:', notifErr.message);
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/applications/:id - delete an application
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch application documents to delete their files from Supabase Storage
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('application_id', id);

    if (docError) {
      console.error('Error fetching application documents for cleanup:', docError.message);
    } else if (docs && docs.length > 0) {
      const filePaths = docs.map(d => d.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('student-documents')
          .remove(filePaths);
        if (storageError) {
          console.error('Failed to clean up application files from storage:', storageError.message);
        }
      }
    }

    // 2. Nullify references on other tables (payments has application_id FK with no cascade)
    const { error: payError } = await supabase
      .from('payments')
      .update({ application_id: null })
      .eq('application_id', id);
    if (payError) console.error('Error nullifying payments application links:', payError.message);

    // 3. Delete application (cascades to documents, counseling, visa, offer_letters, university_apps etc via DB FK cascade)
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Application deleted successfully.' });
  } catch (err) {
    console.error('DELETE /applications error:', err.message);
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

// GET /api/applications/:id/can-proceed - check if application can proceed to next stage
router.get('/:id/can-proceed', authenticate, async (req, res) => {
  try {
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('current_stage, student_id')
      .eq('id', req.params.id)
      .single();

    if (appError) throw appError;
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Students can only check their own application
    if (req.user.profile?.role === 'student' && application.student_id !== req.user.profile.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentStage = application.current_stage;
    
    // Stages that require document approval before proceeding
    const stagesRequiringDocumentApproval = [
      'initial_assessment', 'counseling', 'university_selection', 
      'application_submission', 'offer_letter', 'tuition_deposit', 
      'visa_application', 'pre_departure', 'enrolled'
    ];

    // If current stage is document_upload or earlier, check document status
    const stageOrder = [
      'registered', 'profile_completion', 'document_upload', 'initial_assessment',
      'counseling', 'university_selection', 'application_submission', 'offer_letter',
      'tuition_deposit', 'visa_application', 'pre_departure', 'enrolled'
    ];

    const currentStageIndex = stageOrder.indexOf(currentStage);
    const nextStage = stageOrder[currentStageIndex + 1] || null;

    // Check if next stage requires document approval
    if (nextStage && stagesRequiringDocumentApproval.includes(nextStage)) {
      const { data: documents, error: docError } = await supabase
        .from('documents')
        .select('id, document_name, status, category')
        .eq('application_id', req.params.id);

      if (docError) throw docError;

      // Check if there are any documents
      if (!documents || documents.length === 0) {
        return res.json({
          can_proceed: false,
          current_stage: currentStage,
          next_stage: nextStage,
          reason: 'No documents uploaded',
          message: 'You must upload your documents before proceeding to the next stage.',
          documents_uploaded: 0,
          documents_approved: 0,
          documents_pending: 0
        });
      }

      // Count document statuses
      const approved = documents.filter(doc => doc.status === 'approved').length;
      const pending = documents.filter(doc => doc.status !== 'approved').length;
      const unapprovedDocs = documents.filter(doc => doc.status !== 'approved');

      if (pending > 0) {
        return res.json({
          can_proceed: false,
          current_stage: currentStage,
          next_stage: nextStage,
          reason: 'Documents pending approval',
          message: `${pending} document(s) are still pending approval. All documents must be approved before proceeding.`,
          documents_uploaded: documents.length,
          documents_approved: approved,
          documents_pending: pending,
          unapproved_documents: unapprovedDocs.map(doc => ({
            name: doc.document_name,
            status: doc.status,
            category: doc.category
          }))
        });
      }
    }

    // All checks passed
    res.json({
      can_proceed: true,
      current_stage: currentStage,
      next_stage: nextStage,
      message: 'You can proceed to the next stage.',
      documents_uploaded: null,
      documents_approved: null,
      documents_pending: 0
    });
  } catch (err) {
    console.error('GET /applications/:id/can-proceed error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
