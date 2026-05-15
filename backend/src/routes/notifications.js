const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications - get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.profile?.id || req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /notifications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all - mark all as read
// NOTE: must be registered BEFORE /:id/read to avoid Express matching "read-all" as an :id
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('PATCH /notifications/read-all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read - mark single notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.profile?.id || req.user.id;
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PATCH /notifications/:id/read error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
