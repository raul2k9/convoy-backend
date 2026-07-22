import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from './db/pool.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import convoyRoutes from './routes/convoys.js';
import vehicleRoutes from './routes/vehicles.js';
import statusRoutes from './routes/status.js';
import chatRoutes from './routes/chat.js';
import checkpointRoutes from './routes/checkpoints.js';
import geofenceRoutes from './routes/geofences.js';
import auditRoutes from './routes/audit.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/convoys', convoyRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/checkpoints', checkpointRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/audit', auditRoutes);

// Socket.IO authentication and real-time features
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.user.email);

  socket.on('join-convoy', (convoyId) => {
    socket.join(`convoy:${convoyId}`);
  });

  socket.on('leave-convoy', (convoyId) => {
    socket.leave(`convoy:${convoyId}`);
  });

  socket.on('vehicle-location', async (data) => {
    try {
      const { vehicleId, lat, lng, heading } = data;
      await pool.query(
        'UPDATE vehicles SET lat = $1, lng = $2, heading = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [lat, lng, heading, vehicleId]
      );
      const vResult = await pool.query('SELECT convoy_id FROM vehicles WHERE id = $1', [vehicleId]);
      if (vResult.rows[0]) {
        const convoyId = vResult.rows[0].convoy_id;
        io.to(`convoy:${convoyId}`).emit('vehicle-location', {
          vehicleId, lat, lng, heading, updatedAt: new Date().toISOString()
        });
        // Check geofences
        const fences = await pool.query('SELECT * FROM geofences WHERE convoy_id = $1', [convoyId]);
        const toRad = (x) => x * Math.PI / 180;
        for (const f of fences.rows) {
          const R = 6371e3;
          const dLat = toRad(f.lat - lat);
          const dLon = toRad(f.lng - lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(f.lat)) * Math.sin(dLon / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist <= f.radius && f.alert_on_enter) {
            io.to(`convoy:${convoyId}`).emit('geofence-alert', { type: 'enter', geofenceId: f.id, name: f.name, vehicleId, lat, lng, distance: dist });
          } else if (dist > f.radius && f.alert_on_exit) {
            io.to(`convoy:${convoyId}`).emit('geofence-alert', { type: 'exit', geofenceId: f.id, name: f.name, vehicleId, lat, lng, distance: dist });
          }
        }
      }
    } catch (err) {
      console.error('Vehicle location error:', err);
    }
  });

  socket.on('chat-message', async (data) => {
    try {
      const { convoyId, message, broadcast, mediaUrl } = data;
      const result = await pool.query(
        `INSERT INTO chat_messages (convoy_id, user_id, user_name, user_role, message, broadcast, media_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [convoyId, socket.user.id, socket.user.displayName || socket.user.email, socket.user.role, message, broadcast || false, mediaUrl || null]
      );
      const msg = result.rows[0];
      const eventRoom = broadcast ? 'broadcast' : `convoy:${convoyId}`;
      const payload = {
        id: msg.id,
        convoyId: msg.convoy_id,
        userId: msg.user_id,
        userName: msg.user_name,
        userRole: msg.user_role,
        message: msg.message,
        broadcast: msg.broadcast,
        mediaUrl: msg.media_url,
        createdAt: msg.created_at
      };
      if (broadcast) io.emit('chat-message', payload);
      else io.to(eventRoom).emit('chat-message', payload);
    } catch (err) {
      console.error('Chat error:', err);
    }
  });

  socket.on('status-update', async (data) => {
    try {
      const { convoyId, vehicleId, type, note } = data;
      const result = await pool.query(
        `INSERT INTO status_updates (convoy_id, vehicle_id, user_id, type, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [convoyId, vehicleId || null, socket.user.id, type, note]
      );
      const status = result.rows[0];
      io.to(`convoy:${convoyId}`).emit('status-update', {
        id: status.id,
        convoyId: status.convoy_id,
        vehicleId: status.vehicle_id,
        userId: status.user_id,
        type: status.type,
        note: status.note,
        acknowledged: false,
        createdAt: status.created_at
      });
    } catch (err) {
      console.error('Status update error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.user.email);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Convoy backend running on port ${PORT}`);
});
