import { useRef, useEffect, useCallback } from 'react';

export const useCanvas = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastPos = useRef({ x: null, y: null });
  const boundsRef = useRef({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    hasDrawing: false,
  });

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

    // reset drawing bounds
    boundsRef.current = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      hasDrawing: false,
    };
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

    // update handwriting bounds for cropping (draw only)
    if (data.action === 'draw') {
      const b = boundsRef.current;
      b.minX = Math.min(b.minX, currentX);
      b.minY = Math.min(b.minY, currentY);
      b.maxX = Math.max(b.maxX, currentX);
      b.maxY = Math.max(b.maxY, currentY);
      b.hasDrawing = true;
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
    lastPos.current = { x: null, y: null };
    boundsRef.current = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      hasDrawing: false,
    };
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
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const bounds = boundsRef.current;
    if (!bounds.hasDrawing || bounds.minX === Infinity) {
      // fall back to full canvas if nothing drawn
      return canvas.toDataURL('image/png');
    }

    const padding = 40;
    const sx = Math.max(0, Math.floor(bounds.minX - padding));
    const sy = Math.max(0, Math.floor(bounds.minY - padding));
    const ex = Math.min(canvas.width, Math.ceil(bounds.maxX + padding));
    const ey = Math.min(canvas.height, Math.ceil(bounds.maxY + padding));
    const sw = Math.max(1, ex - sx);
    const sh = Math.max(1, ey - sy);

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = sw;
    tmpCanvas.height = sh;
    const tmpCtx = tmpCanvas.getContext('2d');
    if (!tmpCtx) return canvas.toDataURL('image/png');

    // white background + cropped content
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, sw, sh);
    tmpCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return tmpCanvas.toDataURL('image/png');
  }, []);

  return { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage };
};