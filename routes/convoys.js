import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireApproved, requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = express.Router();

function mapConvoy(c) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    origin: c.origin,
    destination: c.destination,
    status: c.status,
    createdBy: c.created_by,
    createdAt: c.created_at
  };
}

router.get('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM convoys ORDER BY created_at DESC');
    res.json(result.rows.map(mapConvoy));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch convoys' });
  }
});

router.get('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    const convoy = await pool.query('SELECT * FROM convoys WHERE id = $1', [req.params.id]);
    if (convoy.rows.length === 0) return res.status(404).json({ error: 'Convoy not found' });

    const [vehicles, checkpoints, geofences] = await Promise.all([
      pool.query('SELECT * FROM vehicles WHERE convoy_id = $1 ORDER BY created_at DESC', [req.params.id]),
      pool.query('SELECT * FROM checkpoints WHERE convoy_id = $1 ORDER BY sequence, created_at', [req.params.id]),
      pool.query('SELECT * FROM geofences WHERE convoy_id = $1 ORDER BY created_at DESC', [req.params.id])
    ]);

    res.json({
      ...mapConvoy(convoy.rows[0]),
      vehicles: vehicles.rows,
      checkpoints: checkpoints.rows,
      geofences: geofences.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch convoy' });
  }
});

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { name, description, origin, destination, status = 'active' } = req.body;
    const result = await pool.query(
      'INSERT INTO convoys (name, description, origin, destination, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, origin, destination, status, req.user.id]
    );
    await logAudit(req.user.id, 'CREATE_CONVOY', 'convoy', result.rows[0].id, { name });
    res.status(201).json(mapConvoy(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create convoy' });
  }
});

router.put('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { name, description, origin, destination, status } = req.body;
    await pool.query(
      'UPDATE convoys SET name = $1, description = $2, origin = $3, destination = $4, status = $5 WHERE id = $6',
      [name, description, origin, destination, status, req.params.id]
    );
    await logAudit(req.user.id, 'UPDATE_CONVOY', 'convoy', req.params.id, { name });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update convoy' });
  }
});

router.delete('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query('DELETE FROM convoys WHERE id = $1', [req.params.id]);
    await logAudit(req.user.id, 'DELETE_CONVOY', 'convoy', req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete convoy' });
  }
});

export default router;
