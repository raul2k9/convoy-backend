import express from 'express';
import { getAuditLogs } from '../lib/audit.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await getAuditLogs(parseInt(req.query.limit) || 100);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
