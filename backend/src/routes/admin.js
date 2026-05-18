const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/admin/dashboard - admin overview stats
router.get('/dashboard', authenticate, requireRole('admin', 'counselor'), async (req, res) => {
  try {
    const [applicationsRes, studentsRes, documentsRes, paymentsRes] = await Promise.all([
      supabase.from('applications').select('current_stage, is_active'),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student'),
      supabase.from('documents').select('status', { count: 'exact' }),
      supabase.from('payments').select('status, amount'),
    ]);

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
      total_students: studentsRes.count || 0,
      total_applications: applicationsRes.data?.length || 0,
      stage_breakdown: stageBreakdown,
      document_status: docStatusBreakdown,
      total_revenue: totalRevenue,
    });
  } catch (err) {
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

// DELETE /api/admin/staff/:id - remove a staff member
router.delete('/staff/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    const requesterId = req.user.profile?.id || req.user.id;
    if (id === requesterId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    // Delete from auth (cascades to profiles via FK)
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

    // Delete from auth (cascades to profiles, applications, documents etc via FK)
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('DELETE /admin/students error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
