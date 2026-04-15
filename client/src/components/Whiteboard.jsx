import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useCanvas } from '../hooks/useCanvas';
import WhiteboardToolbar from './Toolbar';

import {
  Typography, Box, Paper, Button,
  Container, Stack, Divider, List, ListItem, ListItemText
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

// For this Vite client we read the socket URL from env with a safe fallback
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Whiteboard() {
  const { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage } = useCanvas();
  const [isProcessing, setIsProcessing] = useState(false);
  const [socket, setSocket] = useState(null);
  const [recentWords, setRecentWords] = useState([]);
  const [pointer, setPointer] = useState({ x: null, y: null, mode: 'idle' });

  const autoConvertTimeout = useRef(null);
  const hasUnconvertedDrawing = useRef(false);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('[+] Connected to backend'));
    newSocket.on('draw_event', (data) => {
      draw(data);
      if (data.action === 'draw' || data.action === 'erase') {
        hasUnconvertedDrawing.current = true;
        if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);

        if (typeof data.normalizedX === 'number' && typeof data.normalizedY === 'number') {
          setPointer({ x: data.normalizedX, y: data.normalizedY, mode: data.action });
        }
      } else if (data.action === 'stop' || data.action === 'hover') {
        if (hasUnconvertedDrawing.current) {
          if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
          autoConvertTimeout.current = setTimeout(() => {
            triggerBeautify(newSocket);
          }, 2000);
        }

        if (data.action === 'stop') {
          setPointer({ x: null, y: null, mode: 'idle' });
        }
      }
    });

    newSocket.on('clear_canvas', () => clearCanvas());
    newSocket.on('is_beautifying', (status) => setIsProcessing(status));

    newSocket.on('beautify_result', (beautifulText) => {
      drawBeautifulText(beautifulText);
      setRecentWords(prev => [beautifulText, ...prev].slice(0, 5));
    });

    newSocket.on('init_canvas', (history) => {
      history.forEach(d => draw(d));
      draw({ action: 'stop' });
    });

    return () => {
      if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
      newSocket.disconnect();
    };
  }, [draw, clearCanvas, drawBeautifulText]);

  const triggerBeautify = (activeSocket = socket) => {
    if (!activeSocket) return;
    const base64Image = getCanvasImage();
    if (base64Image) activeSocket.emit('beautify_request', base64Image);
    hasUnconvertedDrawing.current = false;
  };

  const handleClear = () => {
    if (socket) socket.emit('clear_canvas');
    clearCanvas();
    if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
    hasUnconvertedDrawing.current = false;
    setPointer({ x: null, y: null, mode: 'idle' });
  };

  const handleManualBeautify = () => {
    if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
    triggerBeautify();
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5', pb: 5, pt: 10 }}>
      <WhiteboardToolbar />

      <Container maxWidth="lg" sx={{ mt: 8 }}>
        <Paper elevation={4} sx={{
          position: 'relative',
          width: '100%',
          height: '500px',
          overflow: 'hidden',
          borderRadius: 2,
          mb: 4,
          border: '2px solid #e2e8f0',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />
          {pointer.x !== null && pointer.y !== null && (
            <Box
              sx={{
                position: 'absolute',
                left: `${pointer.x * 100}%`,
                top: `${pointer.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: pointer.mode === 'erase' ? 32 : 18,
                height: pointer.mode === 'erase' ? 32 : 18,
                borderRadius: '999px',
                border: pointer.mode === 'erase' ? '2px solid #f97373' : '2px solid #38bdf8',
                boxShadow:
                  pointer.mode === 'erase'
                    ? '0 0 14px rgba(248,113,113,0.85)'
                    : '0 0 14px rgba(56,189,248,0.9)',
                backgroundColor:
                  pointer.mode === 'erase'
                    ? 'rgba(248,113,113,0.15)'
                    : 'rgba(15,23,42,0.45)',
                pointerEvents: 'none',
                transition: 'left 40ms linear, top 40ms linear',
              }}
            />
          )}
        </Paper>

        <Paper elevation={2} sx={{ p: 4, borderRadius: 2, backgroundColor: '#ffffff' }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
            Air Ink Studio
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1, mb: 1, color: '#0f172a' }}>
            Turn gestures into perfect type
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Write in the air, we clean it up and project beautiful text back to your canvas.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleClear}>
              Clear board
            </Button>
            <Button variant="contained" color="primary" startIcon={<AutoAwesomeIcon />} onClick={handleManualBeautify} disabled={isProcessing}>
              Beautify now
            </Button>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                <SmartToyIcon sx={{ mr: 1, color: isProcessing ? '#8b5cf6' : '#64748b' }} />
                {isProcessing ? 'AI is processing...' : 'Status: Idle'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isProcessing ? "Reading your handwriting via Vision AI..." : "Write a word in the air and pause for 2 seconds."}
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                Recent outputs
              </Typography>
              {recentWords.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Your beautiful words will appear here.
                </Typography>
              ) : (
                <List dense sx={{ pt: 0 }}>
                  {recentWords.map((word, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                      <FiberManualRecordIcon sx={{ fontSize: 10, color: '#3b82f6', mr: 1.5 }} />
                      <ListItemText primary={word} primaryTypographyProps={{ fontWeight: 'medium' }} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}