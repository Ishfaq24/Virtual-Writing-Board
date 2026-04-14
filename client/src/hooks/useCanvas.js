import { useRef, useEffect, useCallback } from 'react';

export const useCanvas = () => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const lastPos = useRef({ x: null, y: null });

    useEffect(() => {
        const canvas = canvasRef.current;
        // Make canvas full screen
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctxRef.current = ctx;

        // Handle window resize dynamically
        const handleResize = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            tempCtx.drawImage(canvas, 0, 0);

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Restore context settings after resize
            const newCtx = canvas.getContext('2d');
            newCtx.lineCap = 'round';
            newCtx.lineJoin = 'round';
            newCtx.drawImage(tempCanvas, 0, 0);
            ctxRef.current = newCtx;
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Wrap in useCallback so it doesn't trigger re-renders
    const draw = useCallback((data) => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        
        if (!ctx || !canvas) return;

        // Map normalized coordinates (0.0 - 1.0) back to actual screen pixels
        // Use a fallback of 0 if normalized data is missing to prevent NaN errors
        const currentX = (data.normalizedX || 0) * canvas.width;
        const currentY = (data.normalizedY || 0) * canvas.height;

        if (data.action === 'stop' || data.action === 'hover') {
            lastPos.current = { x: null, y: null };
            return;
        }

        if (data.action === 'erase') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 40; 
        } else if (data.action === 'draw') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#2563eb'; // Blue color
        }

        if (lastPos.current.x !== null) {
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
        }

        lastPos.current = { x: currentX, y: currentY };
    }, []);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    return { canvasRef, draw, clearCanvas };
};