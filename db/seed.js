import bcrypt from 'bcryptjs';
import pool from './pool.js';

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@1csra.in';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role, approved)
       VALUES ($1, $2, 'Admin', 'admin', true)
       ON CONFLICT (email) DO UPDATE SET
         role = 'admin',
         approved = true,
         password_hash = EXCLUDED.password_hash`,
      [email, hash]
    );
    console.log('Admin user created/updated:', email);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();
