import { useRef, useEffect, useCallback } from 'react';

export const useCanvas = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastPos = useRef({ x: null, y: null });

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // set canvas internal resolution to parent size for crisp drawing
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(300, Math.floor(rect.width));
    canvas.height = Math.max(200, Math.floor(rect.height));

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // white background for OCR
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  const draw = useCallback((data) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || !data) return;

    const currentX = (data.normalizedX ?? 0) * canvas.width;
    const currentY = (data.normalizedY ?? 0) * canvas.height;

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
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawBeautifulText = useCallback((text) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    clearCanvas();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1976d2';
    // choose a large size that scales reasonably
    const fontSize = Math.max(48, Math.floor(Math.min(canvas.width, canvas.height) / 6));
    ctx.font = `bold ${fontSize}px Roboto, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }, [clearCanvas]);

  const getCanvasImage = useCallback(() => {
    if (!canvasRef.current) return null;
    // return PNG data URL
    return canvasRef.current.toDataURL('image/png');
  }, []);

  return { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage };
};