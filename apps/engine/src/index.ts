import express from 'express';
import cors from 'cors';

import { createServer } from 'http';
import { Server } from 'socket.io';
import jobsRoutes from './api/routes/jobs.routes';
import resultsRoutes from './api/routes/results.routes';
import analyticsRoutes from './api/routes/analytics.routes';
import exportRoutes from './api/routes/export.routes';
import proxiesRoutes from './api/routes/proxies.routes';
import apikeysRoutes from './api/routes/apikeys.routes';
import './core/orchestrator'; // Initialize BullMQ Worker

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/jobs', jobsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/proxies', proxiesRoutes);
app.use('/api/keys', apikeysRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// Socket.io for Real-time Streaming
io.on('connection', (socket) => {
  console.log('🔌 Client connected to real-time stream:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected');
  });
});

// Global Socket Export for Core to use
export const socketServer = io;

httpServer.listen(port, () => {
  console.log(`🚀 Engine API + WebSocket running on http://localhost:${port}`);
});
