const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');
const { sendEmail, templates } = require('../lib/mailer');
const { getRedisClient } = require('../lib/redis');

// ── Helper: generate 6-digit OTP ─────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Redis OTP helpers ─────────────────────────────────────────
// All OTP/reset data is stored in Redis with a TTL so it auto-expires.
// Keys:
//   otp:{email}        → JSON { otp, userData }          TTL: 15 min
//   reset:{email}      → JSON { token, userId }          TTL: 60 min

const OTP_TTL_SECONDS   = 15 * 60;  // 15 minutes
const RESET_TTL_SECONDS = 60 * 60;  // 1 hour

async function setOTP(email, otp, userData) {
  const redis = getRedisClient();
  await redis.set(
    `otp:${email.toLowerCase()}`,
    JSON.stringify({ otp, userData }),
    'EX', OTP_TTL_SECONDS
  );
}

async function getOTP(email) {
  const redis = getRedisClient();
  const raw = await redis.get(`otp:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

async function deleteOTP(email) {
  const redis = getRedisClient();
  await redis.del(`otp:${email.toLowerCase()}`);
}

async function setResetToken(email, token, userId) {
  const redis = getRedisClient();
  await redis.set(
    `reset:${email.toLowerCase()}`,
    JSON.stringify({ token, userId }),
    'EX', RESET_TTL_SECONDS
  );
}

async function getResetToken(email) {
  const redis = getRedisClient();
  const raw = await redis.get(`reset:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

async function deleteResetToken(email) {
  const redis = getRedisClient();
  await redis.del(`reset:${email.toLowerCase()}`);
}

// ─────────────────────────────────────────────────────────────

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

    // Generate OTP and persist to Redis
    const otp = generateOTP();
    await setOTP(email, otp, { full_name, email, phone, nationality, preferred_study_destination, password });

    // Send verification email (non-blocking)
    let emailSent = false;
    try {
      const { subject, html } = templates.verificationEmail(full_name, otp);
      await sendEmail({ to: email, subject, html });
      emailSent = true;
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    res.status(200).json({
      message: emailSent
        ? 'Verification code sent to your email. Please check your inbox.'
        : 'Account created. Email delivery failed — please contact support or check server logs.',
      email,
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

    const stored = await getOTP(email);

    if (!stored) {
      // Either never existed or Redis TTL expired
      return res.status(400).json({ error: 'Verification code has expired or was not found. Please register again.' });
    }

    if (stored.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    // OTP valid — remove it immediately (one-time use)
    await deleteOTP(email);

    const { full_name, phone, nationality, preferred_study_destination, password } = stored.userData;

    // Create confirmed auth user
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

    // Create profile row
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

    const stored = await getOTP(email);

    if (!stored) {
      return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    }

    // Generate a fresh OTP (resets the TTL too)
    const otp = generateOTP();
    await setOTP(email, otp, stored.userData);

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

// ── PASSWORD RESET FLOW ──────────────────────────────────────

// POST /api/auth/forgot-password — Step 1: request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', email.toLowerCase())
      .single();

    // Always return success (don't reveal whether the email exists)
    if (!profile) {
      return res.json({
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    const resetToken = generateOTP();
    await setResetToken(email, resetToken, profile.id);

    try {
      const { subject, html } = templates.passwordResetEmail(profile.full_name, resetToken, email);
      await sendEmail({ to: email, subject, html });
    } catch (emailErr) {
      console.error('Password reset email failed:', emailErr.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
      }
    }

    res.json({
      message: 'If an account exists with this email, you will receive a password reset link.',
      ...(process.env.NODE_ENV !== 'production' ? { dev_token: resetToken } : {}),
    });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/verify-reset-token — Step 2: verify reset token
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ error: 'Email and reset code are required' });
    }

    const stored = await getResetToken(email);

    if (!stored) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    if (stored.token !== token.trim()) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    res.json({ message: 'Reset code verified. You can now set a new password.' });
  } catch (err) {
    console.error('Verify reset token error:', err.message);
    res.status(500).json({ error: 'Failed to verify reset code' });
  }
});

// POST /api/auth/reset-password — Step 3: set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, new_password } = req.body;

    if (!email || !token || !new_password) {
      return res.status(400).json({ error: 'Email, reset code, and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const stored = await getResetToken(email);

    if (!stored) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    if (stored.token !== token.trim()) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      stored.userId,
      { password: new_password }
    );

    if (updateError) throw updateError;

    // Consume the token (one-time use)
    await deleteResetToken(email);

    // Send confirmation email (non-blocking)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', stored.userId)
        .single();

      if (profile) {
        const { subject, html } = templates.passwordChangedEmail(profile.full_name);
        await sendEmail({ to: email, subject, html });
      }
    } catch (emailErr) {
      console.error('Password changed email failed:', emailErr.message);
    }

    // In-app notification
    await supabase.from('notifications').insert({
      user_id: stored.userId,
      type: 'success',
      title: 'Password Changed',
      message: 'Your password has been successfully changed. You can now sign in with your new password.',
      link: '/login',
    });

    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;