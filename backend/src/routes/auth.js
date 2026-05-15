const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');

// POST /api/auth/register - student self-registration
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, nationality, preferred_study_destination, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password are required' });
    }

    // Create auth user with email already confirmed so they can log in immediately
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || '',
        nationality: nationality || '',
        preferred_study_destination: preferred_study_destination || '',
      },
    });

    if (authError) throw authError;

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'student',
        full_name,
        email,
        phone,
        nationality,
        preferred_study_destination,
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // Create empty student profile
    await supabase.from('student_profiles').insert({ user_id: authData.user.id });

    // In-app welcome notification
    await supabase.from('notifications').insert({
      user_id: authData.user.id,
      type: 'success',
      title: 'Welcome to Aldanex!',
      message: `Welcome ${full_name}! Please complete your profile to get started.`,
      link: '/dashboard/profile',
    });

    // Welcome email (non-blocking)
    try {
      const { subject, html } = templates.welcomeEmail(full_name, profile.student_id);
      await sendEmail({ to: email, subject, html });
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Registration successful. You can now sign in.',
      student_id: profile.student_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message?.toLowerCase().includes('email not confirmed')) {
        return res.status(401).json({ error: 'Email not confirmed. Please contact support.' });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { ...data.user, profile },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await supabase.auth.admin.signOut(req.user.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
