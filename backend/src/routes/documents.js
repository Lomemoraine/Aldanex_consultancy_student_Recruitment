const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');

// GET /api/documents/:applicationId - list documents for an application
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .order('category');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/upload-url - get a signed upload URL from Supabase Storage
router.post('/upload-url', authenticate, async (req, res) => {
  try {
    const { file_name, file_type, category, application_id } = req.body;

    if (!file_name || !category || !application_id) {
      return res.status(400).json({ error: 'file_name, category, and application_id are required' });
    }

    const filePath = `documents/${application_id}/${category}/${Date.now()}_${file_name}`;

    const { data, error } = await supabase.storage
      .from('student-documents')
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    res.json({ upload_url: data.signedUrl, file_path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents - register a document after upload
router.post('/', authenticate, async (req, res) => {
  try {
    const { application_id, category, document_name, file_path, file_type, file_size_kb, expiry_date } = req.body;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('student-documents')
      .getPublicUrl(file_path);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        application_id,
        student_id: req.user.profile.id,
        category,
        document_name,
        file_url: urlData.publicUrl,
        file_type,
        file_size_kb,
        expiry_date,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Notify counselor
    const { data: app } = await supabase
      .from('applications')
      .select('assigned_counselor_id')
      .eq('id', application_id)
      .single();

    if (app?.assigned_counselor_id) {
      await supabase.from('notifications').insert({
        user_id: app.assigned_counselor_id,
        type: 'action_required',
        title: 'New Document Uploaded',
        message: `A student has uploaded a new document: ${document_name}`,
        link: `/admin/applications/${application_id}/documents`,
      });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/documents/:id/review - approve or reject a document
router.patch('/:id/review', authenticate, requireRole('admin', 'counselor', 'admissions'), async (req, res) => {
  try {
    const { status, reviewer_notes } = req.body;
    const validStatuses = ['approved', 'rejected', 'resubmit_requested'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        status,
        reviewer_id: req.user.profile.id,
        reviewer_notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify student
    const notifMessages = {
      approved: { type: 'success', title: 'Document Approved', msg: `Your document "${data.document_name}" has been approved.` },
      rejected: { type: 'warning', title: 'Document Rejected', msg: `Your document "${data.document_name}" was rejected. ${reviewer_notes || ''}` },
      resubmit_requested: { type: 'action_required', title: 'Document Resubmission Required', msg: `Please resubmit "${data.document_name}". ${reviewer_notes || ''}` },
    };

    const notif = notifMessages[status];
    await supabase.from('notifications').insert({
      user_id: data.student_id,
      type: notif.type,
      title: notif.title,
      message: notif.msg,
      link: '/dashboard/documents',
    });

    // Send document review email
    try {
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.student_id)
        .single();

      if (student) {
        const { subject, html } = templates.documentReviewEmail(
          student.full_name, data.document_name, status, reviewer_notes
        );
        await sendEmail({ to: student.email, subject, html });
      }
    } catch (emailErr) {
      console.error('Document review email failed:', emailErr.message);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
