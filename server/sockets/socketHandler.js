// Handles real-time drawing events
module.exports = (io) => {
    let canvasState = []; // In-memory store (use Redis/MongoDB in production)
    let logCounter = 0;   // Used to throttle console logs so it doesn't spam

    io.on('connection', (socket) => {
        console.log(`[+] User/Client connected: ${socket.id}`);
        
        // Sync new user with current whiteboard state
        socket.emit('init_canvas', canvasState);

        socket.on('gesture_data', (data) => {
            // Debugging: Log every 30th frame to verify data is arriving from Python
            logCounter++;
            if (logCounter % 30 === 0) {
                console.log(`[DATA RECEIVED] Action: ${data.action} | X: ${data.x}, Y: ${data.y}`);
            }

            // CRITICAL FIX: Use io.emit instead of socket.broadcast.emit
            // This guarantees the event goes to ALL connected clients (React apps)
            io.emit('draw_event', data);
            
            // Save state if it's a valid drawing/erasing action
            if (data.action === 'draw' || data.action === 'erase') {
                canvasState.push(data);
                // Prevent memory leak in dev mode
                if(canvasState.length > 50000) canvasState.shift(); 
            }
        });

        socket.on('clear_canvas', () => {
            canvasState = [];
            io.emit('clear_canvas');
            console.log('[!] Canvas cleared by client');
        });

        socket.on('disconnect', () => {
            console.log(`[-] User/Client disconnected: ${socket.id}`);
        });
    });
};