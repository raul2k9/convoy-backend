import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = express.Router();

router.get('/convoy/:convoyId', authenticateToken, requireApproved, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM checkpoints WHERE convoy_id = $1 ORDER BY sequence, created_at',
      [req.params.convoyId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      convoyId: r.convoy_id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      eta: r.eta,
      sequence: r.sequence,
      arrivedAt: r.arrived_at,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch checkpoints' });
  }
});

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { convoyId, name, lat, lng, eta, sequence = 0 } = req.body;
    const result = await pool.query(
      'INSERT INTO checkpoints (convoy_id, name, lat, lng, eta, sequence) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [convoyId, name, lat, lng, eta || null, sequence]
    );
    await logAudit(req.user.id, 'CREATE_CHECKPOINT', 'checkpoint', result.rows[0].id, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkpoint' });
  }
});

router.put('/:id/arrive', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query(
      'UPDATE checkpoints SET arrived_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark checkpoint arrival' });
  }
});

router.put('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { name, lat, lng, eta, sequence } = req.body;
    await pool.query(
      'UPDATE checkpoints SET name = $1, lat = $2, lng = $3, eta = $4, sequence = $5 WHERE id = $6',
      [name, lat, lng, eta || null, sequence, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update checkpoint' });
  }
});

router.delete('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query('DELETE FROM checkpoints WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete checkpoint' });
  }
});

export default router;
