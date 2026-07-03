const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');
const { sendSMS, smsTemplates } = require('../lib/sms');

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
    const { application_id, category, document_name, file_path, file_type, file_size_kb, expiry_date, student_id } = req.body;

    // If student_id is provided (admin uploading on behalf), use it; otherwise use logged-in user's ID
    const finalStudentId = student_id || req.user.profile?.id || req.user.id;

    console.log('Creating document record:', {
      application_id,
      student_id: finalStudentId,
      category,
      document_name,
      uploaded_by: req.user.profile?.id || req.user.id,
      uploaded_by_role: req.user.profile?.role || req.user.role,
    });

    // Store the file_path (not a public URL) — signed URLs are generated on read
    const { data, error } = await supabase
      .from('documents')
      .insert({
        application_id,
        student_id: finalStudentId,
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

    if (error) {
      console.error('Document insert error:', error);
      throw error;
    }

    console.log('Document created successfully:', data.id);

    // Generate signed URL for the response
    const signedUrl = await getSignedUrl(file_path);
    const result = { ...data, file_url: signedUrl };

    // Notify counselor
    const { data: app } = await supabase
      .from('applications')
      .select('assigned_counselor_id, student_id')
      .eq('id', application_id)
      .single();

    if (app?.assigned_counselor_id) {
      await supabase.from('notifications').insert({
        user_id: app.assigned_counselor_id,
        type: 'action_required',
        title: 'New Document Uploaded',
        message: `A document has been uploaded for a student: ${document_name}`,
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

    // Send email + SMS (non-blocking)
    try {
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', data.student_id)
        .single();

      if (student) {
        // For approved documents, check if ALL documents are now approved
        if (status === 'approved') {
          // Get all documents for this application
          const { data: allDocs } = await supabase
            .from('documents')
            .select('id, status')
            .eq('application_id', data.application_id);

          const totalDocs = allDocs?.length || 0;
          const approvedDocs = allDocs?.filter(d => d.status === 'approved').length || 0;

          // Only send email if ALL documents are approved
          if (totalDocs > 0 && approvedDocs === totalDocs) {
            const { subject, html } = templates.allDocumentsApprovedEmail(student.full_name, totalDocs);
            await sendEmail({ to: student.email, subject, html });

            // SMS for all documents approved
            if (student.phone) {
              const firstName = student.full_name.split(' ')[0];
              const smsBody = smsTemplates.allDocumentsApproved(firstName);
              sendSMS(student.phone, smsBody).catch(() => {});
            }
          }
          // If not all approved yet, don't send email (only in-app notification)
        } else {
          // For rejected or resubmit_requested, send email immediately
          const { subject, html } = templates.documentReviewEmail(
            student.full_name, data.document_name, status, reviewer_notes
          );
          await sendEmail({ to: student.email, subject, html });

          // SMS
          if (student.phone) {
            const firstName = student.full_name.split(' ')[0];
            let smsBody;
            if (status === 'rejected') {
              smsBody = smsTemplates.documentRejected(firstName, data.document_name, reviewer_notes);
            }
            if (smsBody) sendSMS(student.phone, smsBody).catch(() => {});
          }
        }
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

// DELETE /api/documents/:id - delete a document (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch doc to get the file_path
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      // If it doesn't exist, we can return success or 404. Let's return 404 if not found.
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      throw fetchError;
    }

    if (doc?.file_path) {
      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([doc.file_path]);
      
      if (storageError) {
        console.error('Storage deletion failed:', storageError.message);
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    res.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('DELETE /documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id/download - secure download endpoint
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.profile?.id || req.user.id;

    // Fetch document and verify ownership
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*, applications!inner(student_id)')
      .eq('id', id)
      .single();

    if (fetchError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Security check: Only allow student to download their own documents
    // OR allow staff (admin, counselor, etc.) to download any document
    const isOwner = doc.applications.student_id === userId;
    const isStaff = ['admin', 'counselor', 'admissions', 'visa_officer'].includes(req.user.profile?.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(doc.file_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return res.status(500).json({ error: 'Failed to download file' });
    }

    // Extract filename from path (preserves original filename with extension)
    const filename = doc.file_path.split('/').pop();
    
    // Determine content type - use stored file_type or infer from extension
    let contentType = doc.file_type || 'application/octet-stream';
    
    // If no file_type stored, infer from filename extension
    if (!doc.file_type && filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      contentType = mimeTypes[ext] || 'application/octet-stream';
    }

    // Set headers to force download with correct content type
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Convert blob to buffer and send
    const buffer = Buffer.from(await fileData.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    console.error('GET /documents/:id/download error:', err.message);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

module.exports = router;

