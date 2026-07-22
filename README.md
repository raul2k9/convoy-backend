# Convoy Backend

Node.js/Express backend for the 1CSR(A) Convoy Manager app.

## Features
- JWT authentication
- PostgreSQL database
- Socket.IO real-time updates
- REST API for users, convoys, vehicles, status updates, chat

## Local Development

### Prerequisites
- PostgreSQL installed locally, or a remote database URL
- Node.js 18+

### Setup
1. Copy environment file:
```bash
cp .env.example .env
```

2. Update `.env` with your database URL and JWT secret.

3. Install dependencies:
```bash
npm install
```

4. Initialize database:
```bash
npm run db:init
npm run db:seed
```

5. Start server:
```bash
npm run dev
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user (pending approval)
- `POST /api/auth/login` - Login and receive JWT

### Users
- `GET /api/users/me` - Get current user profile
- `GET /api/users` - List all users (admin only)
- `PUT /api/users/:id/approve` - Approve a user (admin only)
- `PUT /api/users/:id/lock` - Lock/unlock a user (admin only)

### Convoys
- `GET /api/convoys` - List convoys
- `GET /api/convoys/:id` - Get convoy with vehicles
- `POST /api/convoys` - Create convoy
- `PUT /api/convoys/:id` - Update convoy
- `DELETE /api/convoys/:id` - Delete convoy

### Vehicles
- `POST /api/vehicles` - Add vehicle to convoy
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle

### Status Updates
- `GET /api/status/:convoyId` - Get status updates for convoy
- `POST /api/status` - Create status update

### Chat
- `GET /api/chat/:convoyId` - Get chat messages for convoy
- `POST /api/chat` - Send chat message

### Socket.IO Events
- `join-convoy` / `leave-convoy` - Join/leave a convoy room
- `vehicle-location` - Broadcast vehicle GPS location
- `chat-message` - Send/receive chat messages
- `status-update` - Send/receive status updates

## Deploy to Render

1. Create PostgreSQL database on Render
2. Create Web Service with root directory `convoy-backend`
3. Set environment variables from `.env.example`
4. Build command: `npm install`
5. Start command: `npm start`
6. After deploy, run `npm run db:init` and `npm run db:seed` in Render Shell
