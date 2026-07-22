import bcrypt from 'bcryptjs';
import pool from './pool.js';

const testUsers = [
  { email: 'admin2@1csra.in', password: 'Admin@123', displayName: 'Test Admin', role: 'admin', approved: true },
  { email: 'driver@1csra.in', password: 'Driver@123', displayName: 'Test Driver', role: 'driver', approved: true },
  { email: 'incharge@1csra.in', password: 'Incharge@123', displayName: 'Test In-charge', role: 'incharge', approved: true },
  { email: 'pending@1csra.in', password: 'Pending@123', displayName: 'Test Pending User', role: 'driver', approved: false }
];

async function seedTestUsers() {
  try {
    for (const u of testUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      await pool.query(
        `INSERT INTO users (email, password_hash, display_name, role, approved)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           approved = EXCLUDED.approved`,
        [u.email, hash, u.displayName, u.role, u.approved]
      );
      console.log('Created/updated:', u.email, u.role, u.approved ? 'approved' : 'pending');
    }
    console.log('Test users seeded successfully');
  } catch (err) {
    console.error('Seed test users error:', err);
  } finally {
    await pool.end();
  }
}

seedTestUsers();
