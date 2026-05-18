const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * POST /api/setup/test-sms — verify Twilio is working (dev only)
 */
router.post('/test-sms', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    const { phone, setup_key } = req.body;
    if (setup_key !== process.env.SETUP_KEY) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'phone is required (E.164 format e.g. +254712345678)' });
    }
    const { sendSMS } = require('../lib/sms');
    const result = await sendSMS(
      phone,
      `Aldanex SMS test ✓ — notifications are working! ${new Date().toLocaleTimeString()}`
    );
    if (result) {
      res.json({ success: true, sid: result.sid, message: `SMS sent to ${phone}` });
    } else {
      res.json({ success: false, message: 'SMS skipped — check TWILIO_* env vars or phone number format' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/admin
 * One-time route to create the first admin account.
 */
router.post('/admin', async (req, res) => {
  try {
    const { full_name, email, password, setup_key } = req.body;

    // Simple protection — require a setup key from .env
    if (setup_key !== process.env.SETUP_KEY) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password are required' });
    }

    // Check if admin already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      // Just promote existing user to admin
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', email);

      if (updateError) throw updateError;
      return res.json({ message: `${email} has been promoted to admin. You can now log in.` });
    }

    // Create new admin user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    });

    if (authError) throw authError;

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'admin',
        full_name,
        email,
      });

    if (profileError) throw profileError;

    res.status(201).json({
      message: `Admin account created for ${email}. You can now log in at /login.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
