const { createClient } = require('@supabase/supabase-js');

/**
 * Middleware to verify Supabase JWT and attach user to request
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT by calling Supabase auth
    const verifyClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await verifyClient.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch profile using service role (bypasses RLS)
    const adminSupabase = require('../lib/supabase');
    const { data: profiles, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, role, full_name, email, student_id, phone, nationality')
      .eq('id', user.id)
      .limit(1);

    if (profileError) {
      console.error('Auth middleware - profile fetch error:', profileError.message);
      req.user = { ...user, profile: null };
      return next();
    }

    const profile = profiles?.[0] || null;

    if (!profile) {
      console.warn('Auth middleware - no profile found for user:', user.id, '- attempting recovery');
      try {
        // Try upsert with ON CONFLICT to handle race conditions
        const { data: newProfile, error: insertError } = await adminSupabase
          .from('profiles')
          .upsert({
            id: user.id,
            role: 'student',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
            email: user.email,
            phone: user.user_metadata?.phone || null,
            nationality: user.user_metadata?.nationality || null,
            preferred_study_destination: user.user_metadata?.preferred_study_destination || null,
          }, { onConflict: 'id', ignoreDuplicates: false })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to upsert profile:', insertError.message);
          // Profile might exist but query failed due to RLS — try fetching again
          const { data: retryProfile } = await adminSupabase
            .from('profiles')
            .select('id, role, full_name, email, student_id, phone, nationality')
            .eq('email', user.email)
            .limit(1);

          if (retryProfile && retryProfile.length > 0) {
            req.user = { ...user, profile: retryProfile[0] };
            return next();
          }

          req.user = { ...user, profile: null };
          return next();
        }

        // Create student_profiles and application rows
        await adminSupabase.from('student_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
        await adminSupabase.from('applications').upsert({ student_id: user.id, current_stage: 'registered' }, { onConflict: 'student_id', ignoreDuplicates: true });

        req.user = { ...user, profile: newProfile };
      } catch (createErr) {
        console.error('Auto-create profile exception:', createErr.message);
        req.user = { ...user, profile: null };
      }
      return next();
    }

    req.user = { ...user, profile };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to restrict access to specific roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.profile?.role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!roles.includes(req.user.profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
