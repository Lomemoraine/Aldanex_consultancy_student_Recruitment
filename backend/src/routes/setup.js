const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * POST /api/setup/admin
 * One-time route to create the first admin account.
 * Disable this route after first use in production.
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
