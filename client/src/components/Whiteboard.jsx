import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useCanvas } from '../hooks/useCanvas';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function Whiteboard() {
    const { canvasRef, draw, clearCanvas } = useCanvas();

    useEffect(() => {
        console.log("Attempting to connect to server...");
        const socket = io(SOCKET_SERVER_URL);

        socket.on('connect', () => {
            console.log('[+] Connected to Socket.io server with ID:', socket.id);
        });
        
        let logCounter = 0;
        socket.on('draw_event', (data) => {
            // Debugging: Log every 30th frame to browser console to prevent spam
            logCounter++;
            if (logCounter % 30 === 0) {
                console.log('[REACT] Received draw event:', data);
            }
            
            draw(data);
        });

        socket.on('clear_canvas', () => {
            console.log('[REACT] Canvas cleared');
            clearCanvas();
        });

        // Replay existing canvas state on load
        socket.on('init_canvas', (history) => {
            console.log(`[REACT] Loaded history with ${history.length} strokes`);
            history.forEach(data => draw(data));
            // Reset position after drawing history
            draw({ action: 'stop' }); 
        });

        return () => {
            console.log('[-] Disconnecting socket');
            socket.disconnect();
        };
        // CRITICAL FIX: Empty dependency array []! 
        // This ensures the socket connects exactly ONCE when the component mounts.
    }, []); 

    return (
        <div className="relative w-screen h-screen bg-slate-50 overflow-hidden">
            {/* Toolbar Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-lg flex gap-4 z-10 border border-slate-200">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-700">AI Tracking Active</span>
                </div>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <span className="text-sm text-slate-500">☝️ Draw</span>
                <span className="text-sm text-slate-500">✌️ Erase</span>
                <span className="text-sm text-slate-500">✊ Stop</span>
            </div>

            <canvas 
                ref={canvasRef} 
                className="w-full h-full cursor-crosshair"
            />
        </div>
    );
}