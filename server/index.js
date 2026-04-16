const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandler = require('./sockets/socketHandler');

const app = express();

// Restrict CORS to the configured frontend origin(s), while allowing common local dev ports.
const DEFAULT_CLIENT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = CLIENT_ORIGINS.length > 0 ? CLIENT_ORIGINS : DEFAULT_CLIENT_ORIGINS;

app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
}));

// Simple health-check endpoint for readiness/liveness probes
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
    },
});

// Initialize WebSocket routes
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`[INFO] Server running on http://localhost:${PORT} (allowed origins: ${ALLOWED_ORIGINS.join(', ')})`);
});