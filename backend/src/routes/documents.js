const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');

const BUCKET = 'student-documents';
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Generate a signed URL for a file path.
 * Handles both raw paths and legacy full URLs.
 */
async function getSignedUrl(filePath) {
  if (!filePath) return null;

  // Extract just the path if it's a full Supabase URL
  // e.g. https://xxx.supabase.co/storage/v1/object/public/student-documents/documents/...
  let path = filePath;
  if (filePath.includes('/storage/v1/object/')) {
    const match = filePath.match(/student-documents\/(.+)/);
    if (match) {
      path = match[1];
    } else {
      // Can't extract path — return original URL as fallback
      return filePath;
    }
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Signed URL error for path:', path, '|', error.message);
      return filePath; // return original as fallback
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Signed URL exception:', err.message);
    return filePath;
  }
}

// GET /api/documents/:applicationId - list documents with fresh signed URLs
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .order('category');

    if (error) throw error;

    // Generate signed URLs for all documents in parallel
    const enriched = await Promise.all((data || []).map(async (doc) => {
      const signedUrl = await getSignedUrl(doc.file_path || doc.file_url);
      return { ...doc, file_url: signedUrl };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('GET /documents error:', err.message);
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
      .from(BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    res.json({ upload_url: data.signedUrl, file_path: filePath });
  } catch (err) {
    console.error('POST /documents/upload-url error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents - register a document after upload
router.post('/', authenticate, async (req, res) => {
  try {
    const { application_id, category, document_name, file_path, file_type, file_size_kb, expiry_date } = req.body;

    const studentId = req.user.profile?.id || req.user.id;

    // Store the file_path (not a public URL) — signed URLs are generated on read
    const { data, error } = await supabase
      .from('documents')
      .insert({
        application_id,
        student_id: studentId,
        category,
        document_name,
        file_url: file_path,   // store path, not public URL
        file_path: file_path,  // also store in dedicated column
        file_type,
        file_size_kb,
        expiry_date,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Generate signed URL for the response
    const signedUrl = await getSignedUrl(file_path);
    const result = { ...data, file_url: signedUrl };

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
        link: `/admin/documents`,
      });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('POST /documents error:', err.message);
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

    const reviewerId = req.user.profile?.id || req.user.id;

    const { data, error } = await supabase
      .from('documents')
      .update({
        status,
        reviewer_id: reviewerId,
        reviewer_notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify student
    const notifMessages = {
      approved:           { type: 'success',          title: 'Document Approved',              msg: `Your document "${data.document_name}" has been approved.` },
      rejected:           { type: 'warning',          title: 'Document Rejected',              msg: `Your document "${data.document_name}" was rejected. ${reviewer_notes || ''}` },
      resubmit_requested: { type: 'action_required',  title: 'Document Resubmission Required', msg: `Please resubmit "${data.document_name}". ${reviewer_notes || ''}` },
    };

    const notif = notifMessages[status];
    await supabase.from('notifications').insert({
      user_id: data.student_id,
      type: notif.type,
      title: notif.title,
      message: notif.msg,
      link: '/dashboard/documents',
    });

    // Send email (non-blocking)
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
    console.error('PATCH /documents/:id/review error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
