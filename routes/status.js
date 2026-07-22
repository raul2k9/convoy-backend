import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = express.Router();

router.get('/:convoyId', authenticateToken, requireApproved, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.display_name as user_name, v.name as vehicle_name, ab.display_name as acknowledged_by_name
       FROM status_updates s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN vehicles v ON s.vehicle_id = v.id
       LEFT JOIN users ab ON s.acknowledged_by = ab.id
       WHERE s.convoy_id = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [req.params.convoyId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      convoyId: r.convoy_id,
      vehicleId: r.vehicle_id,
      vehicleName: r.vehicle_name,
      userId: r.user_id,
      userName: r.user_name,
      type: r.type,
      note: r.note,
      status: r.type,
      acknowledged: r.acknowledged,
      acknowledgedBy: r.acknowledged_by,
      acknowledgedByName: r.acknowledged_by_name,
      acknowledgedAt: r.acknowledged_at,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch status updates' });
  }
});

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { convoyId, vehicleId, type, note } = req.body;
    const result = await pool.query(
      `INSERT INTO status_updates (convoy_id, vehicle_id, user_id, type, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [convoyId, vehicleId || null, req.user.id, type, note]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create status update' });
  }
});

router.put('/:id/acknowledge', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query(
      'UPDATE status_updates SET acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP WHERE id = $2',
      [req.user.id, req.params.id]
    );
    await logAudit(req.user.id, 'ACKNOWLEDGE_STATUS', 'status_update', req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to acknowledge status' });
  }
});

export default router;
