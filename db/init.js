import pool from './pool.js';

const migrationStatements = [
  `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'dark'`,
  `ALTER TABLE IF EXISTS convoys ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE IF EXISTS convoys ADD COLUMN IF NOT EXISTS origin VARCHAR(255)`,
  `ALTER TABLE IF EXISTS convoys ADD COLUMN IF NOT EXISTS destination VARCHAR(255)`,
  `ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'truck'`,
  `ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES users(id)`,
  `ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS incharge_id UUID REFERENCES users(id)`,
  `ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS escort_contact VARCHAR(255)`,
  `ALTER TABLE IF EXISTS status_updates ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false`,
  `ALTER TABLE IF EXISTS status_updates ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id)`,
  `ALTER TABLE IF EXISTS status_updates ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP`,
  `ALTER TABLE IF EXISTS chat_messages ADD COLUMN IF NOT EXISTS broadcast BOOLEAN DEFAULT false`,
  `ALTER TABLE IF EXISTS chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT`
];

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'driver',
    approved BOOLEAN DEFAULT false,
    locked BOOLEAN DEFAULT false,
    lock_reason TEXT,
    theme VARCHAR(20) DEFAULT 'dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS convoys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    origin VARCHAR(255),
    destination VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    convoy_id UUID REFERENCES convoys(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'truck',
    registration VARCHAR(255),
    driver_name VARCHAR(255),
    driver_contact VARCHAR(255),
    driver_id UUID REFERENCES users(id),
    incharge_name VARCHAR(255),
    incharge_rank VARCHAR(255),
    incharge_contact VARCHAR(255),
    incharge_id UUID REFERENCES users(id),
    escort_name VARCHAR(255),
    escort_contact VARCHAR(255),
    assigned_to UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'idle',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    convoy_id UUID REFERENCES convoys(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    note TEXT,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    convoy_id UUID REFERENCES convoys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    message TEXT NOT NULL,
    broadcast BOOLEAN DEFAULT false,
    media_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    convoy_id UUID REFERENCES convoys(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    eta TIMESTAMP,
    sequence INTEGER DEFAULT 0,
    arrived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    convoy_id UUID REFERENCES convoys(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius INTEGER DEFAULT 500,
    alert_on_enter BOOLEAN DEFAULT true,
    alert_on_exit BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS vehicle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    description TEXT,
    cost NUMERIC(10,2),
    odometer INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_convoy ON vehicles(convoy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_status_convoy ON status_updates(convoy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_convoy ON chat_messages(convoy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_checkpoints_convoy ON checkpoints(convoy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_geofences_convoy ON geofences(convoy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicle_logs_vehicle ON vehicle_logs(vehicle_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`
];

export async function init() {
  try {
    for (const stmt of migrationStatements) {
      await pool.query(stmt);
    }
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database init error:', err);
    process.exitCode = 1;
  }
}
