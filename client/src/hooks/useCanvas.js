import { useRef, useEffect, useCallback } from 'react';

export const useCanvas = () => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const lastPos = useRef({ x: null, y: null });

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // CRITICAL FOR AI: Fill background with solid white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctxRef.current = ctx;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const newCtx = canvas.getContext('2d');
            newCtx.lineCap = 'round';
            newCtx.lineJoin = 'round';
            newCtx.fillStyle = "#ffffff";
            newCtx.fillRect(0, 0, canvas.width, canvas.height);
            ctxRef.current = newCtx;
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const draw = useCallback((data) => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

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
            ctx.lineWidth = 10;
            // CRITICAL FOR AI: Use solid black ink for maximum contrast
            ctx.strokeStyle = '#000000'; 
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
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    const drawBeautifulText = useCallback((text) => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!ctx || !canvas) return;

        clearCanvas(); // Wipe the messy writing
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#2563eb'; // Blue text for the final beautiful result
        ctx.font = 'bold 100px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }, [clearCanvas]);

    const getCanvasImage = useCallback(() => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
    }, []);

    return { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage };
};