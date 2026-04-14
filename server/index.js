const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandler = require('./sockets/socketHandler');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow React frontend and Python client
        methods: ["GET", "POST"]
    }
});

// Initialize WebSocket routes
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`[INFO] Server running on http://localhost:${PORT}`);
});