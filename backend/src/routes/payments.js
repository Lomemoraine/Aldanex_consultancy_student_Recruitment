const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

const BUCKET = 'student-documents';
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Generate a signed URL for a file path.
 * Handles both raw paths and legacy full URLs.
 */
async function getSignedUrl(filePath) {
  if (!filePath) return null;

  // Extract just the path if it's a full Supabase URL
  let path = filePath;
  if (filePath.includes('/storage/v1/object/')) {
    const match = filePath.match(/student-documents\/(.+)/);
    if (match) {
      path = match[1];
    } else {
      return filePath;
    }
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Signed URL error for path:', path, '|', error.message);
      return filePath;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Signed URL exception:', err.message);
    return filePath;
  }
}

// GET /api/payments/:applicationId
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Generate signed URLs for receipts (for admin viewing)
    const enriched = await Promise.all((data || []).map(async (payment) => {
      if (payment.receipt_url) {
        const signedUrl = await getSignedUrl(payment.receipt_url);
        return { ...payment, receipt_url: signedUrl };
      }
      return payment;
    }));

    res.json(enriched);
  } catch (err) {
    console.error('GET /payments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/log - student logs a manual payment
router.post('/log', authenticate, async (req, res) => {
  try {
    const {
      application_id, payment_type, amount, currency,
      provider, provider_reference, status
    } = req.body;

    const studentId = req.user.profile?.id || req.user.id;

    const { data, error } = await supabase
      .from('payments')
      .insert({
        student_id: studentId,
        application_id,
        payment_type,
        amount: Number(amount),
        currency: currency || 'USD',
        provider: provider || 'Bank Transfer',
        provider_reference: provider_reference || null,
        status: status || 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /payments/log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/payments/:id/receipt - upload receipt URL
router.patch('/:id/receipt', authenticate, async (req, res) => {
  try {
    const { receipt_url, status } = req.body;

    // Get public URL from Supabase storage
    const { data: urlData } = supabase.storage
      .from('student-documents')
      .getPublicUrl(receipt_url);

    const { data, error } = await supabase
      .from('payments')
      .update({
        receipt_url: urlData.publicUrl,
        status: status || 'uploaded',
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify admissions team via notification to all admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'admissions']);

    if (admins?.length) {
      await supabase.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.id,
          type: 'action_required',
          title: 'Payment Receipt Uploaded',
          message: `A student has uploaded a payment receipt for ${data.payment_type}. Please verify.`,
          link: `/admin/payments`,
        }))
      );
    }

    res.json(data);
  } catch (err) {
    console.error('PATCH /payments/:id/receipt error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/create-intent - create Stripe payment intent
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { amount, currency = 'usd', payment_type, application_id } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency,
      metadata: {
        student_id: req.user.profile.id,
        application_id,
        payment_type,
      },
    });

    // Log payment record
    await supabase.from('payments').insert({
      student_id: req.user.profile.id,
      application_id,
      payment_type,
      amount,
      currency: currency.toUpperCase(),
      provider: 'Stripe',
      provider_reference: paymentIntent.id,
      status: 'pending',
    });

    res.json({ client_secret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/webhook - Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      await supabase
        .from('payments')
        .update({ status: 'verified' })
        .eq('provider_reference', pi.id);

      // Notify student
      if (pi.metadata?.student_id) {
        await supabase.from('notifications').insert({
          user_id: pi.metadata.student_id,
          type: 'success',
          title: 'Payment Successful',
          message: `Your payment of ${pi.amount / 100} ${pi.currency.toUpperCase()} has been confirmed.`,
          link: '/dashboard/payments',
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/payments/:id/verify - manually verify payment (admin)
router.patch('/:id/verify', authenticate, requireRole('admin', 'admissions'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'verified' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/:id/receipt/download - secure receipt download
router.get('/:id/receipt/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.profile?.id || req.user.id;

    // Fetch payment record
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (!payment.receipt_url) {
      return res.status(404).json({ error: 'No receipt available for this payment' });
    }

    // Security check: Only allow student to download their own receipts
    // OR allow staff (admin, counselor, etc.) to download any receipt
    const isOwner = payment.student_id === userId;
    const isStaff = ['admin', 'counselor', 'admissions', 'visa_officer'].includes(req.user.profile?.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Extract file path from receipt_url (handle both legacy URLs and paths)
    let filePath = payment.receipt_url;
    if (filePath.includes('/storage/v1/object/')) {
      const match = filePath.match(/student-documents\/(.+)/);
      if (match) {
        filePath = match[1];
      }
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('student-documents')
      .download(filePath);

    if (downloadError) {
      console.error('Receipt download error:', downloadError);
      return res.status(500).json({ error: 'Failed to download receipt' });
    }

    // Extract filename from path (preserves original filename with extension)
    const filename = filePath.split('/').pop();
    
    // Infer content type from filename extension
    let contentType = 'application/octet-stream';
    if (filename) {
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
    console.error('GET /payments/:id/receipt/download error:', err.message);
    res.status(500).json({ error: 'Failed to download receipt' });
  }
});

module.exports = router;
