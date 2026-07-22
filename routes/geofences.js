import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = express.Router();

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get('/convoy/:convoyId', authenticateToken, requireApproved, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM geofences WHERE convoy_id = $1 ORDER BY created_at DESC',
      [req.params.convoyId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      convoyId: r.convoy_id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      radius: r.radius,
      alertOnEnter: r.alert_on_enter,
      alertOnExit: r.alert_on_exit,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
});

router.post('/check', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { convoyId, vehicleId, lat, lng } = req.body;
    const fences = await pool.query('SELECT * FROM geofences WHERE convoy_id = $1', [convoyId]);
    const vehicle = await pool.query('SELECT name FROM vehicles WHERE id = $1', [vehicleId]);
    const vehicleName = vehicle.rows[0]?.name || 'Vehicle';
    const alerts = [];

    for (const f of fences.rows) {
      const distance = haversine(lat, lng, f.lat, f.lng);
      const inside = distance <= f.radius;
      const key = `${vehicleId}:${f.id}`;
      // Simple stateless check; in production this would compare previous state
      if (inside && f.alert_on_enter) {
        alerts.push({ type: 'enter', geofence: f, vehicleName, distance });
      } else if (!inside && f.alert_on_exit) {
        alerts.push({ type: 'exit', geofence: f, vehicleName, distance });
      }
    }
    res.json({ alerts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check geofences' });
  }
});

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { convoyId, name, lat, lng, radius, alertOnEnter, alertOnExit } = req.body;
    const result = await pool.query(
      'INSERT INTO geofences (convoy_id, name, lat, lng, radius, alert_on_enter, alert_on_exit) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [convoyId, name, lat, lng, radius || 500, alertOnEnter ?? true, alertOnExit ?? false]
    );
    await logAudit(req.user.id, 'CREATE_GEOFENCE', 'geofence', result.rows[0].id, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

router.delete('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query('DELETE FROM geofences WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete geofence' });
  }
});

export default router;
