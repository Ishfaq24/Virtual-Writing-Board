import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useCanvas } from '../hooks/useCanvas';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function Whiteboard() {
    const { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage } = useCanvas();
    const [isProcessing, setIsProcessing] = useState(false);
    const [socket, setSocket] = useState(null); // Save socket to state to use it in buttons
    
    // Timers for Auto-AI
    const autoConvertTimeout = useRef(null);
    const hasUnconvertedDrawing = useRef(false);

    useEffect(() => {
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => console.log('[+] Connected'));
        
        newSocket.on('draw_event', (data) => {
            draw(data);

            // 🪄 AUTO-MAGIC TIMER LOGIC
            if (data.action === 'draw' || data.action === 'erase') {
                hasUnconvertedDrawing.current = true;
                if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
            } 
            else if (data.action === 'stop' || data.action === 'hover') {
                if (hasUnconvertedDrawing.current) {
                    if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
                    
                    // Wait 2 seconds after writing stops, then capture and send to AI
                    autoConvertTimeout.current = setTimeout(() => {
                        console.log("⏱️ Auto-triggering AI...");
                        const base64Image = getCanvasImage();
                        if (base64Image) {
                            newSocket.emit('beautify_request', base64Image);
                        }
                        hasUnconvertedDrawing.current = false;
                    }, 2000); 
                }
            }
        });

        newSocket.on('clear_canvas', () => clearCanvas());
        newSocket.on('is_beautifying', (status) => setIsProcessing(status));
        
        newSocket.on('beautify_result', (beautifulText) => {
            console.log("AI Converted Text:", beautifulText);
            drawBeautifulText(beautifulText);
        });

        newSocket.on('init_canvas', (history) => {
            history.forEach(data => draw(data));
            draw({ action: 'stop' }); 
        });

        return () => {
            if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
            newSocket.disconnect();
        };
    }, [draw, clearCanvas, drawBeautifulText, getCanvasImage]);

    // Handle clicking the manual Clear / Trash button
    const handleClear = () => {
        if (socket) {
            socket.emit('clear_canvas');
        }
        clearCanvas();
        // Abort the AI countdown if the user manually cleared the board
        if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
        hasUnconvertedDrawing.current = false;
    };

    return (
        <div className="relative w-screen h-screen bg-white overflow-hidden">
            {/* Toolbar Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-lg flex gap-4 z-10 border border-slate-200 items-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-700">Tracking</span>
                </div>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <span className="text-sm text-slate-500">☝️ Draw</span>
                <span className="text-sm text-slate-500">✌️ Erase</span>
                <span className="text-sm text-slate-500">✊ Stop</span>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                
                {/* 🗑️ Explicit Clear Button */}
                <button 
                    onClick={handleClear}
                    className="px-3 py-1.5 rounded-full text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                    🗑️ Clear
                </button>

                {/* Auto-AI Status Indicator */}
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold text-white transition-all duration-300 ${
                        isProcessing ? 'bg-indigo-600 animate-pulse scale-105 shadow-md' : 'bg-slate-400'
                    }`}
                >
                    {isProcessing ? '🤖 AI Reading...' : '✨ Auto-Beautify Ready'}
                </div>
            </div>

            <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
        </div>
    );
}