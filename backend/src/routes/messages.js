const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

// GET /api/messages/:applicationId - get conversation for an application
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Enrich with sender info separately to avoid FK join issues
    const senderIds = [...new Set((data || []).map(m => m.sender_id))];
    let senderMap = {};

    if (senderIds.length > 0) {
      const { data: senders } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', senderIds);

      (senders || []).forEach((s) => { senderMap[s.id] = s; });
    }

    const enriched = (data || []).map(m => ({
      ...m,
      sender: senderMap[m.sender_id] || null,
    }));

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('application_id', req.params.applicationId)
      .eq('recipient_id', userId)
      .eq('is_read', false);

    res.json(enriched);
  } catch (err) {
    console.error('GET /messages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages - send a message
router.post('/', authenticate, async (req, res) => {
  try {
    const { application_id, recipient_id, content } = req.body;
    const userId = req.user.profile?.id || req.user.id;
    const senderName = req.user.profile?.full_name || 'Your counselor';

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        application_id,
        sender_id: userId,
        recipient_id,
        content: content.trim(),
      })
      .select('*')
      .single();

    if (error) throw error;

    // Attach sender info
    const result = {
      ...data,
      sender: {
        id: userId,
        full_name: senderName,
        role: req.user.profile?.role,
      },
    };

    // Notify recipient
    await supabase.from('notifications').insert({
      user_id: recipient_id,
      type: 'info',
      title: 'New Message',
      message: `You have a new message from ${senderName}`,
      link: `/dashboard/messages`,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('POST /messages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
