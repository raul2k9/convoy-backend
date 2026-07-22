import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = express.Router();

router.get('/:convoyId', authenticateToken, requireApproved, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.display_name as user_name, u.role as user_role
       FROM chat_messages c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.convoy_id = $1
       ORDER BY c.created_at ASC
       LIMIT 200`,
      [req.params.convoyId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      convoyId: r.convoy_id,
      userId: r.user_id,
      userName: r.user_name,
      userRole: r.user_role,
      message: r.message,
      broadcast: r.broadcast,
      mediaUrl: r.media_url,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { convoyId, message, broadcast, mediaUrl } = req.body;
    const result = await pool.query(
      `INSERT INTO chat_messages (convoy_id, user_id, user_name, user_role, message, broadcast, media_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [convoyId, req.user.id, req.user.displayName || req.user.email, req.user.role, message, broadcast || false, mediaUrl || null]
    );
    if (broadcast) await logAudit(req.user.id, 'BROADCAST_MESSAGE', 'convoy', convoyId, { message });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
