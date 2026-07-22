import pool from '../db/pool.js';

export async function logAudit(userId, action, targetType, targetId, details = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, targetType, targetId || null, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

export async function getAuditLogs(limit = 100) {
  const result = await pool.query(
    `SELECT a.*, u.display_name as user_name
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: r.details,
    createdAt: r.created_at
  }));
}
