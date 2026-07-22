import express from 'express';
import pool from '../db/pool.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = express.Router();

function vehicleFields(body) {
  return {
    name: body.name,
    type: body.type || 'truck',
    registration: body.number || body.registration,
    driver_name: body.driverName,
    driver_contact: body.driverContact,
    driver_id: body.driverId || null,
    incharge_name: body.inchargeName,
    incharge_rank: body.inchargeRank,
    incharge_contact: body.inchargeContact,
    incharge_id: body.inchargeId || null,
    escort_name: body.escort,
    escort_contact: body.escortContact,
    assigned_to: body.assignedTo || null,
    status: body.status || 'idle'
  };
}

function mapVehicle(v) {
  return {
    id: v.id,
    convoyId: v.convoy_id,
    name: v.name,
    type: v.type,
    number: v.registration,
    registration: v.registration,
    driverName: v.driver_name,
    driverContact: v.driver_contact,
    driverId: v.driver_id,
    inchargeName: v.incharge_name,
    inchargeRank: v.incharge_rank,
    inchargeContact: v.incharge_contact,
    inchargeId: v.incharge_id,
    escort: v.escort_name,
    escortContact: v.escort_contact,
    assignedTo: v.assigned_to,
    status: v.status,
    lat: v.lat,
    lng: v.lng,
    heading: v.heading,
    updatedAt: v.updated_at,
    location: v.lat != null ? { lat: v.lat, lng: v.lng } : null
  };
}

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { convoyId } = req.body;
    const v = vehicleFields(req.body);
    const cols = ['convoy_id', ...Object.keys(v)];
    const vals = [convoyId, ...Object.values(v)];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `INSERT INTO vehicles (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    await logAudit(req.user.id, 'CREATE_VEHICLE', 'vehicle', result.rows[0].id, { name: v.name });
    res.status(201).json(mapVehicle(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.put('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    const v = vehicleFields(req.body);
    const setClause = Object.keys(v).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...Object.values(v), req.params.id];
    await pool.query(`UPDATE vehicles SET ${setClause} WHERE id = $${values.length}`, values);
    await logAudit(req.user.id, 'UPDATE_VEHICLE', 'vehicle', req.params.id, { name: v.name });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.delete('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    await logAudit(req.user.id, 'DELETE_VEHICLE', 'vehicle', req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// Vehicle logs (fuel / maintenance)
router.get('/:id/logs', authenticateToken, requireApproved, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.display_name as user_name
       FROM vehicle_logs l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.vehicle_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      userId: r.user_id,
      userName: r.user_name,
      type: r.type,
      description: r.description,
      cost: r.cost,
      odometer: r.odometer,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vehicle logs' });
  }
});

router.post('/:id/logs', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { type, description, cost, odometer } = req.body;
    const result = await pool.query(
      'INSERT INTO vehicle_logs (vehicle_id, user_id, type, description, cost, odometer) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, req.user.id, type, description, cost || null, odometer || null]
    );
    await logAudit(req.user.id, 'CREATE_VEHICLE_LOG', 'vehicle_log', result.rows[0].id, { type });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create vehicle log' });
  }
});

router.delete('/:id/logs/:logId', authenticateToken, requireApproved, async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_logs WHERE id = $1 AND vehicle_id = $2', [req.params.logId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete vehicle log' });
  }
});

export default router;
