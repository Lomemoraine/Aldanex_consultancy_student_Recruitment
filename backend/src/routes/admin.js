const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/admin/dashboard - admin overview stats
router.get('/dashboard', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;
    const userRole = req.user.profile?.role || req.user.role;
    const isCounselor = userRole === 'counselor';

    let applicationsRes, documentsRes, paymentsRes;

    if (isCounselor) {
      // For counselors: First get their assigned applications
      const { data: apps } = await supabase
        .from('applications')
        .select('current_stage, is_active, student_id')
        .eq('assigned_counselor_id', userId);

      applicationsRes = { data: apps };

      // Get unique student IDs from assigned applications
      const studentIds = [...new Set((apps || []).map(a => a.student_id))];

      // Then get documents and payments for those students
      if (studentIds.length > 0) {
        const [docs, payments] = await Promise.all([
          supabase.from('documents').select('status, student_id').in('student_id', studentIds),
          supabase.from('payments').select('status, amount, student_id').in('student_id', studentIds),
        ]);
        documentsRes = docs;
        paymentsRes = payments;
      } else {
        documentsRes = { data: [] };
        paymentsRes = { data: [] };
      }
    } else {
      // For admins: Get all data
      const [apps, docs, payments] = await Promise.all([
        supabase.from('applications').select('current_stage, is_active, student_id'),
        supabase.from('documents').select('status, student_id'),
        supabase.from('payments').select('status, amount, student_id'),
      ]);
      applicationsRes = apps;
      documentsRes = docs;
      paymentsRes = payments;
    }

    // Get unique student IDs from applications
    const studentIds = [...new Set((applicationsRes.data || []).map(a => a.student_id))];
    const totalStudents = studentIds.length;

    const stageBreakdown = (applicationsRes.data || []).reduce((acc, a) => {
      acc[a.current_stage] = (acc[a.current_stage] || 0) + 1;
      return acc;
    }, {});

    const docStatusBreakdown = (documentsRes.data || []).reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    const totalRevenue = (paymentsRes.data || [])
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    res.json({
      total_students: totalStudents,
      total_applications: applicationsRes.data?.length || 0,
      stage_breakdown: stageBreakdown,
      document_status: docStatusBreakdown,
      total_revenue: totalRevenue,
      is_counselor: isCounselor,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/staff - create staff account
router.post('/staff', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { full_name, email, password, role, phone } = req.body;
    const validRoles = ['counselor', 'admissions', 'visa_officer', 'admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    });

    if (authError) throw authError;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({ id: authData.user.id, role, full_name, email, phone })
      .select()
      .single();

    if (profileError) throw profileError;
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/staff - list all staff
router.get('/staff', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, phone, created_at')
      .in('role', ['counselor', 'admissions', 'visa_officer', 'admin'])
      .order('role');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/counselors - list counselors and admissions officers for assignment
router.get('/counselors', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['counselor', 'admissions'])
      .order('full_name');

    if (error) throw error;
    
    console.log('Counselors fetched for assignment:', data?.length || 0);
    res.json(data || []);
  } catch (err) {
    console.error('GET /admin/counselors error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/students/:id - get student profile and extended profile
router.get('/students/:id', authenticate, requireRole('admin', 'counselor', 'admissions'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (profileError) throw profileError;
    
    // Fetch extended student profile
    const { data: studentProfile, error: studentError } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    
    if (studentError && studentError.code !== 'PGRST116') {
      console.error('Error fetching student profile:', studentError);
    }
    
    res.json({
      profile,
      studentProfile: studentProfile || null
    });
  } catch (err) {
    console.error('GET /admin/students/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/create-student - create student account (admin/counselor/admissions only)
router.post('/create-student', authenticate, requireRole('admin', 'counselor', 'admissions'), async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      date_of_birth,
      nationality,
      current_country,
      education_level,
      field_of_interest,
      preferred_study_destination
    } = req.body;

    console.log('Creating student account:', { email, full_name, nationality, preferred_study_destination });

    // Validation
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'student' },
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      throw authError;
    }

    console.log('Auth user created:', authData.user.id);

    // 2. Create profile (includes nationality and preferred_study_destination)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'student',
        full_name,
        email,
        phone: phone || null,
        nationality: nationality || null,
        preferred_study_destination: preferred_study_destination || null,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Cleanup: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log('Profile created with nationality and destination');

    // 3. Create student profile (extended details)
    const { data: studentProfile, error: studentError } = await supabase
      .from('student_profiles')
      .insert({
        user_id: authData.user.id,
        date_of_birth: date_of_birth || null,
        current_country: current_country || null,
        education_level: education_level || null,
        field_of_interest: field_of_interest || null,
      })
      .select()
      .single();

    if (studentError) {
      console.error('Student profile creation error:', studentError);
      // Cleanup not critical here since FK will cascade
    }

    console.log('Student profile created');

    // 4. Create initial application
    const createdBy = req.user.profile?.id || req.user.id;
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        student_id: authData.user.id,
        current_stage: 'profile_creation',
        is_active: true,
        assigned_counselor_id: req.user.profile?.role === 'counselor' ? createdBy : null,
      })
      .select()
      .single();

    if (appError) {
      console.error('Application creation error:', appError);
    } else {
      console.log('Application created:', application.id);
    }

    // 5. Send welcome notification
    try {
      await supabase.from('notifications').insert({
        user_id: authData.user.id,
        title: 'Welcome to Aldanex Consultancy',
        message: `Your account has been created by ${req.user.profile?.full_name || 'admin'}. You can now log in and complete your profile.`,
        type: 'info',
      });
      console.log('Welcome notification sent');
    } catch (notifErr) {
      console.error('Notification creation error:', notifErr);
    }

    res.status(201).json({
      message: 'Student account created successfully',
      student: {
        id: authData.user.id,
        full_name,
        email,
        application_id: application?.id,
      },
    });
  } catch (err) {
    console.error('POST /admin/create-student error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/staff/:id - remove a staff member
router.delete('/staff/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    const requesterId = req.user.profile?.id || req.user.id;
    if (id === requesterId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    // 1. Nullify references on other tables to prevent foreign key errors
    await supabase.from('applications').update({ assigned_counselor_id: null }).eq('assigned_counselor_id', id);
    await supabase.from('applications').update({ assigned_admissions_id: null }).eq('assigned_admissions_id', id);
    await supabase.from('visa_applications').update({ visa_officer_id: null }).eq('visa_officer_id', id);
    await supabase.from('documents').update({ reviewer_id: null }).eq('reviewer_id', id);
    await supabase.from('tuition_deposits').update({ verified_by: null }).eq('verified_by', id);
    await supabase.from('enrollment_confirmations').update({ confirmed_by: null }).eq('confirmed_by', id);

    // 2. Delete messages and counseling sessions related to this staff member
    await supabase.from('messages').delete().or(`sender_id.eq.${id},recipient_id.eq.${id}`);
    await supabase.from('counseling_sessions').delete().eq('counselor_id', id);

    // 3. Delete from auth (cascades to profiles via FK)
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    res.json({ message: 'Staff member removed successfully.' });
  } catch (err) {
    console.error('DELETE /admin/staff error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/students/:id - delete a student and all their data
router.delete('/students/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch student documents to delete their files from Supabase Storage
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('student_id', id);

    if (docError) {
      console.error('Error fetching student documents for cleanup:', docError.message);
    } else if (docs && docs.length > 0) {
      const filePaths = docs.map(d => d.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('student-documents')
          .remove(filePaths);
        if (storageError) {
          console.error('Failed to clean up student files from storage:', storageError.message);
        }
      }
    }

    // 2. Delete non-cascading student relationships to prevent foreign key errors
    
    // Nullify changed_by in application stage history to prevent constraint blocks
    const { error: histError } = await supabase
      .from('application_stage_history')
      .update({ changed_by: null })
      .eq('changed_by', id);
    if (histError) console.error('Error cleaning student stage history references:', histError.message);

    // counseling_sessions
    const { error: sessionError } = await supabase
      .from('counseling_sessions')
      .delete()
      .eq('student_id', id);
    if (sessionError) console.error('Error cleaning student counseling sessions:', sessionError.message);

    // offer_letters
    const { error: offerError } = await supabase
      .from('offer_letters')
      .delete()
      .eq('student_id', id);
    if (offerError) console.error('Error cleaning student offer letters:', offerError.message);

    // university_applications
    const { error: uniError } = await supabase
      .from('university_applications')
      .delete()
      .eq('student_id', id);
    if (uniError) console.error('Error cleaning student university applications:', uniError.message);

    // tuition_deposits
    const { error: depositError } = await supabase
      .from('tuition_deposits')
      .delete()
      .eq('student_id', id);
    if (depositError) console.error('Error cleaning student tuition deposits:', depositError.message);

    // visa_applications
    const { error: visaError } = await supabase
      .from('visa_applications')
      .delete()
      .eq('student_id', id);
    if (visaError) console.error('Error cleaning student visa applications:', visaError.message);

    // pre_departure
    const { error: prepError } = await supabase
      .from('pre_departure')
      .delete()
      .eq('student_id', id);
    if (prepError) console.error('Error cleaning student pre-departure info:', prepError.message);

    // enrollment_confirmations
    const { error: enrollError } = await supabase
      .from('enrollment_confirmations')
      .delete()
      .eq('student_id', id);
    if (enrollError) console.error('Error cleaning student enrollment confirmations:', enrollError.message);

    // payments
    const { error: payError } = await supabase
      .from('payments')
      .delete()
      .eq('student_id', id);
    if (payError) console.error('Error cleaning student payments:', payError.message);

    // messages
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .or(`sender_id.eq.${id},recipient_id.eq.${id}`);
    if (msgError) console.error('Error cleaning student messages:', msgError.message);

    // notifications
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', id);
    if (notifError) console.error('Error cleaning student notifications:', notifError.message);

    // 3. Delete from auth (cascades to profiles, applications, documents, student_profiles etc. via FK)
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('DELETE /admin/students error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
