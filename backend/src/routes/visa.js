const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSMS, smsTemplates } = require('../lib/sms');

// GET /api/visa - get all applications at visa stage (for admin/counselor management page)
router.get('/', authenticate, requireRole('admin', 'visa_officer', 'admissions', 'counselor'), async (req, res) => {
  try {
    const userRole = req.user.profile?.role;
    const userId = req.user.profile?.id;

    console.log('GET /api/visa - User role:', userRole, 'User ID:', userId);

    // Build query for applications at visa stage
    let query = supabase
      .from('applications')
      .select(`
        id,
        student_id,
        current_stage,
        created_at,
        assigned_counselor_id,
        profiles!applications_student_id_fkey (
          id,
          full_name,
          email,
          student_id,
          nationality,
          preferred_study_destination
        )
      `)
      .eq('current_stage', 'visa_application')
      .order('created_at', { ascending: false });

    // Filter for counselors - only show assigned applications
    if (userRole === 'counselor') {
      query = query.eq('assigned_counselor_id', userId);
    }

    const { data: apps, error: appsError } = await query;

    if (appsError) {
      console.error('Error fetching applications:', appsError);
      throw appsError;
    }

    console.log(`Found ${apps?.length || 0} applications at visa stage`);

    // Load visa applications for each
    const enriched = await Promise.all((apps || []).map(async (app) => {
      console.log(`Fetching visa for application ${app.id}`);
      
      // Get the most recent visa application (in case of duplicates)
      const { data: visas, error: visaError } = await supabase
        .from('visa_applications')
        .select('*')
        .eq('application_id', app.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (visaError) {
        console.error(`Error fetching visa for app ${app.id}:`, visaError);
      }

      const visa = visas?.[0] || null;
      
      if (visa) {
        console.log(`Visa for app ${app.id}: Found (ID: ${visa.id}, Status: ${visa.status})`);
      } else {
        console.log(`Visa for app ${app.id}: Not found`);
      }

      return {
        ...app,
        student: app.profiles || null,
        visa: visa,
      };
    }));

    console.log('Enriched applications:', enriched.map(a => ({ id: a.id, has_visa: !!a.visa })));

    res.json(enriched);
  } catch (err) {
    console.error('GET /api/visa error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/visa/:applicationId
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const userId = req.user.profile?.id;
    const userRole = req.user.profile?.role;
    
    console.log('GET /api/visa/:applicationId:', {
      applicationId,
      userId,
      userRole
    });

    // First, verify the user has access to this application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, student_id')
      .eq('id', applicationId)
      .single();

    if (appError) {
      console.error('Error fetching application:', appError);
      return res.status(404).json({ error: 'Application not found' });
    }

    console.log('Application found:', application);

    // Check access rights
    if (userRole === 'student' && application.student_id !== userId) {
      console.log('Access denied: student can only view their own application');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch the most recent visa application (in case of duplicates)
    const { data: visas, error: visaError } = await supabase
      .from('visa_applications')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (visaError) {
      console.error('Error fetching visa application:', visaError);
      throw visaError;
    }

    const visa = visas?.[0] || null;
    
    console.log('Visa application found:', visa ? 'Yes' : 'No');
    if (visa) {
      console.log('Visa details:', {
        id: visa.id,
        status: visa.status,
        visa_type: visa.visa_type,
        destination_country: visa.destination_country
      });
    }
    
    res.json(visa);
  } catch (err) {
    console.error('GET /api/visa/:applicationId error:', err);
    res.status(500).json({ error: err.message, details: err.toString() });
  }
});

// POST /api/visa - create visa application
router.post('/', authenticate, requireRole('admin', 'visa_officer', 'admissions', 'counselor'), async (req, res) => {
  try {
    const { application_id, student_id, visa_type, destination_country } = req.body;

    // Validate required fields
    if (!application_id || !student_id || !visa_type || !destination_country) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          application_id: !application_id ? 'required' : 'present',
          student_id: !student_id ? 'required' : 'present',
          visa_type: !visa_type ? 'required' : 'present',
          destination_country: !destination_country ? 'required' : 'present',
        }
      });
    }

    console.log('Creating visa application:', { application_id, student_id, visa_type, destination_country });

    // Check if visa application already exists for this application
    const { data: existing, error: checkError } = await supabase
      .from('visa_applications')
      .select('id, status, visa_type')
      .eq('application_id', application_id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for existing visa:', checkError);
      throw checkError;
    }

    if (existing) {
      console.log('Visa application already exists:', existing.id);
      return res.status(409).json({ 
        error: 'Visa application already exists for this application',
        existing_visa: existing
      });
    }

    // Create new visa application
    const { data, error } = await supabase
      .from('visa_applications')
      .insert({
        application_id,
        student_id,
        visa_officer_id: req.user.profile.id,
        visa_type,
        destination_country,
        status: 'not_started',
        checklist: {
          passport: false,
          photos: false,
          bank_statement: false,
          acceptance_letter: false,
          cas_i20: false,
          accommodation_proof: false,
          travel_insurance: false,
          visa_form: false,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating visa:', error);
      throw error;
    }

    console.log('Visa application created successfully:', data.id);

    await supabase.from('notifications').insert({
      user_id: student_id,
      type: 'action_required',
      title: 'Visa Application Started',
      message: `Your ${visa_type} visa application process has begun. Please upload required documents.`,
      link: '/dashboard/visa',
    });

    res.status(201).json(data);
  } catch (err) {
    console.error('POST /api/visa error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/visa/:id - update visa application
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const allowedFields = [
      'status', 'biometrics_booked_at', 'biometrics_appointment_url',
      'submitted_at', 'visa_reference_number', 'mock_interview_scheduled_at',
      'mock_interview_notes', 'interview_date', 'decision', 'decision_date',
      'visa_doc_url', 'checklist'
    ];

    console.log('PATCH /api/visa/:id - Updating visa:', req.params.id);
    console.log('Update fields:', req.body);

    const update = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) update[f] = req.body[f];
    });

    console.log('Filtered update object:', update);

    const { data, error } = await supabase
      .from('visa_applications')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating visa_applications:', error);
      throw error;
    }

    console.log('Visa updated successfully:', data.id);

    // Notify student on decision
    if (update.decision) {
      const isApproved = update.decision === 'approved';
      
      console.log('Decision update detected:', update.decision);
      
      // If visa is approved, automatically progress application to pre_departure stage
      if (isApproved) {
        console.log(`Visa approved for student ${data.student_id}, updating application stage to pre_departure`);
        
        const { error: stageError } = await supabase
          .from('applications')
          .update({ current_stage: 'pre_departure' })
          .eq('id', data.application_id);
        
        if (stageError) {
          console.error('Failed to update application stage:', stageError);
        } else {
          console.log('Application stage updated to pre_departure');
          
          // Notify about stage progression
          await supabase.from('notifications').insert({
            user_id: data.student_id,
            type: 'info',
            title: 'Moving to Pre-Departure Stage',
            message: 'Your application has progressed to the pre-departure stage. Get ready for your journey!',
            link: '/dashboard',
          });
        }
      }
      
      await supabase.from('notifications').insert({
        user_id: data.student_id,
        type: isApproved ? 'success' : 'warning',
        title: `Visa ${isApproved ? 'Approved' : 'Decision Received'}`,
        message: `Your visa application decision: ${update.decision.toUpperCase()}`,
        link: '/dashboard/visa',
      });

      // SMS for visa decision
      try {
        const { data: student } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', data.student_id)
          .single();

        if (student?.phone && isApproved) {
          const smsBody = smsTemplates.visaApproved(student.full_name.split(' ')[0]);
          sendSMS(student.phone, smsBody).catch(() => {});
        } else if (student?.phone && !isApproved) {
          const smsBody = `Hi ${student.full_name.split(' ')[0]}, your visa application decision has been received: ${update.decision.toUpperCase()}. Log in for details: ${process.env.FRONTEND_URL}/dashboard/visa`;
          sendSMS(student.phone, smsBody).catch(() => {});
        }
      } catch (smsErr) {
        console.error('Visa SMS failed:', smsErr.message);
      }
    }

    console.log('Sending response with updated visa data');
    res.json(data);
  } catch (err) {
    console.error('PATCH /api/visa/:id error:', err);
    console.error('Error details:', err.message, err.code, err.details);
    res.status(500).json({ error: err.message, code: err.code, details: err.details });
  }
});

module.exports = router;
