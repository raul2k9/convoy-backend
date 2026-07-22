import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, role, approved, locked, lock_reason, theme FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      approved: user.approved,
      locked: user.locked,
      lockReason: user.lock_reason,
      theme: user.theme || 'dark'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, role, approved, locked, lock_reason, theme, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows.map(u => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      approved: u.approved,
      locked: u.locked,
      lockReason: u.lock_reason,
      theme: u.theme || 'dark',
      createdAt: u.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE users SET approved = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

router.put('/:id/lock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { locked, reason } = req.body;
    await pool.query(
      'UPDATE users SET locked = $1, lock_reason = $2 WHERE id = $3',
      [locked, reason || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lock status' });
  }
});

// Admin credential / profile management
router.put('/:id/credentials', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, displayName, role, password, theme } = req.body;
    const userId = req.params.id;
    const target = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (target.rows[0].role === 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Cannot modify another admin via this endpoint' });
    }

    const updates = [];
    const values = [];
    let idx = 1;
    if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email.toLowerCase()); }
    if (displayName !== undefined) { updates.push(`display_name = $${idx++}`); values.push(displayName); }
    if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role); }
    if (theme !== undefined) { updates.push(`theme = $${idx++}`); values.push(theme); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (updates.length === 0) return res.json({ success: true });
    values.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Self-service profile / password change
router.put('/me/profile', authenticateToken, async (req, res) => {
  try {
    const { displayName, email, theme } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (displayName !== undefined) { updates.push(`display_name = $${idx++}`); values.push(displayName); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email.toLowerCase()); }
    if (theme !== undefined) { updates.push(`theme = $${idx++}`); values.push(theme); }
    if (updates.length === 0) return res.json({ success: true });
    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/me/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Current password and a new password of at least 6 characters are required' });
    }
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
