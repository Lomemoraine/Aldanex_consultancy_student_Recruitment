const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');

// ── Helper: generate 6-digit OTP ─────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── In-memory OTP store (use Redis in production) ─────────────
// Structure: { email: { otp, expiresAt, userData } }
const otpStore = new Map();

// POST /api/auth/register — Step 1: create unconfirmed user, send OTP
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, nationality, preferred_study_destination, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password are required' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store OTP + user data temporarily
    otpStore.set(email.toLowerCase(), {
      otp,
      expiresAt,
      userData: { full_name, email, phone, nationality, preferred_study_destination, password },
    });

    // Send verification email (non-blocking — don't crash if email fails)
    let emailSent = false;
    try {
      const { subject, html } = templates.verificationEmail(full_name, otp);
      await sendEmail({ to: email, subject, html });
      emailSent = true;
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
      // Still proceed — log the OTP to console so you can test manually
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    res.status(200).json({
      message: emailSent
        ? 'Verification code sent to your email. Please check your inbox.'
        : 'Account created. Email delivery failed — please contact support or check server logs.',
      email,
      // Only expose OTP in development when email fails
      ...(process.env.NODE_ENV !== 'production' && !emailSent ? { dev_otp: otp } : {}),
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp — Step 2: verify OTP, create account
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const stored = otpStore.get(email.toLowerCase());

    if (!stored) {
      return res.status(400).json({ error: 'No verification code found. Please register again.' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: 'Verification code has expired. Please register again.' });
    }

    if (stored.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    // OTP valid — create the account
    const { full_name, phone, nationality, preferred_study_destination, password } = stored.userData;
    otpStore.delete(email.toLowerCase());

    // Create auth user (confirmed)
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
      message: `Welcome ${full_name}! Your account is verified. Please complete your profile to get started.`,
      link: '/dashboard/profile',
    });

    // Send welcome email (non-blocking)
    try {
      const { subject, html } = templates.welcomeEmail(full_name, profile.student_id);
      await sendEmail({ to: email, subject, html });
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Account verified successfully. You can now sign in.',
      student_id: profile.student_id,
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/resend-otp — resend verification code
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const stored = otpStore.get(email?.toLowerCase());

    if (!stored) {
      return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    stored.otp = otp;
    stored.expiresAt = Date.now() + 15 * 60 * 1000;
    otpStore.set(email.toLowerCase(), stored);

    const { subject, html } = templates.verificationEmail(stored.userData.full_name, otp);
    await sendEmail({ to: email, subject, html });

    res.json({ message: 'New verification code sent.' });
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
