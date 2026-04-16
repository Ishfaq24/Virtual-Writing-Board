import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useCanvas } from '../hooks/useCanvas';
import WhiteboardToolbar from './Toolbar';

import {
  Typography, Box, Paper, Button,
  Container, Stack, Divider, List, ListItem, ListItemText,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

// For this Vite client we read the socket URL from env with a safe fallback
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const createClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export default function Whiteboard() {
  const { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage } = useCanvas();
  const [isProcessing, setIsProcessing] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recentWords, setRecentWords] = useState([]);
  const [pointer, setPointer] = useState({ x: null, y: null, mode: 'idle' });
  const [aiMode, setAiMode] = useState('word');
  const [aiError, setAiError] = useState(null);

  const autoConvertTimeout = useRef(null);
  const hasUnconvertedDrawing = useRef(false);
  const pointerDrawingRef = useRef(false);
  const pointerModeRef = useRef('draw');
  const clientIdRef = useRef(createClientId());

  const clearAutoConvertTimer = () => {
    if (autoConvertTimeout.current) {
      clearTimeout(autoConvertTimeout.current);
      autoConvertTimeout.current = null;
    }
  };

  const scheduleBeautify = (activeSocket = socket) => {
    if (!hasUnconvertedDrawing.current) return;

    clearAutoConvertTimer();
    autoConvertTimeout.current = setTimeout(() => {
      triggerBeautify(activeSocket);
    }, 2000);
  };

  const emitGestureData = (payload) => {
    if (!socket || !socket.connected) return false;

    socket.emit('gesture_data', {
      ...payload,
      clientId: clientIdRef.current,
    });

    return true;
  };

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  };

  const beginPointerStroke = (event) => {
    const point = getCanvasPoint(event);
    if (!point) return;

    event.preventDefault();
    pointerDrawingRef.current = true;
    pointerModeRef.current = event.button === 2 || event.ctrlKey ? 'erase' : 'draw';

    const canvas = canvasRef.current;
    if (canvas?.setPointerCapture && typeof event.pointerId === 'number') {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore pointer capture errors for browsers that do not support it reliably.
      }
    }

    hasUnconvertedDrawing.current = true;
    clearAutoConvertTimer();

    const payload = {
      action: pointerModeRef.current,
      normalizedX: point.x,
      normalizedY: point.y,
    };

    draw(payload);
    setPointer({ x: point.x, y: point.y, mode: pointerModeRef.current });
    emitGestureData(payload);
  };

  const movePointerStroke = (event) => {
    const point = getCanvasPoint(event);
    if (!point) return;

    if (!pointerDrawingRef.current) {
      return;
    }

    event.preventDefault();
    hasUnconvertedDrawing.current = true;
    clearAutoConvertTimer();

    const payload = {
      action: pointerModeRef.current,
      normalizedX: point.x,
      normalizedY: point.y,
    };

    draw(payload);
    setPointer({ x: point.x, y: point.y, mode: pointerModeRef.current });
    emitGestureData(payload);
  };

  const endPointerStroke = (event) => {
    if (!pointerDrawingRef.current) {
      return;
    }

    event?.preventDefault?.();
    pointerDrawingRef.current = false;

    draw({ action: 'stop' });
    emitGestureData({ action: 'stop' });

    if (hasUnconvertedDrawing.current) {
      scheduleBeautify();
    }

    pointerModeRef.current = 'draw';
    setPointer({ x: null, y: null, mode: 'idle' });
  };

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[+] Connected to backend');
    });
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('connect_error', () => setIsConnected(false));
    newSocket.on('draw_event', (data) => {
      if (data?.clientId && data.clientId === clientIdRef.current) {
        return;
      }

      draw(data);
      if (data.action === 'draw' || data.action === 'erase') {
        hasUnconvertedDrawing.current = true;
        clearAutoConvertTimer();

        if (typeof data.normalizedX === 'number' && typeof data.normalizedY === 'number') {
          setPointer({ x: data.normalizedX, y: data.normalizedY, mode: data.action });
        }
      } else if (data.action === 'stop' || data.action === 'hover') {
        if (hasUnconvertedDrawing.current) {
          scheduleBeautify(newSocket);
        }

        if (data.action === 'stop') {
          setPointer({ x: null, y: null, mode: 'idle' });
        }
      }
    });

    newSocket.on('clear_canvas', () => clearCanvas());
    newSocket.on('is_beautifying', (status) => {
      setIsProcessing(status);
      if (status) {
        // clear any previous error when starting a fresh beautify cycle
        setAiError(null);
      }
    });

    newSocket.on('beautify_result', (beautifulText) => {
      drawBeautifulText(beautifulText);
      setRecentWords(prev => [beautifulText, ...prev].slice(0, 5));
      // clear any existing error on successful result
      setAiError(null);
    });

    newSocket.on('beautify_error', (err) => {
      console.warn('[AI ERROR EVENT]', err);
      if (!err) {
        setAiError('AI failed to process handwriting.');
      } else if (typeof err === 'string') {
        setAiError(err);
      } else {
        setAiError(err.message || 'AI failed to process handwriting.');
      }
    });

    newSocket.on('init_canvas', (history) => {
      history.forEach(d => draw(d));
      draw({ action: 'stop' });
    });

    return () => {
      clearAutoConvertTimer();
      newSocket.disconnect();
    };
  }, [draw, clearCanvas, drawBeautifulText]);

  const triggerBeautify = (activeSocket = socket) => {
    if (!activeSocket) return;
    setAiError(null);
    const base64Image = getCanvasImage();
    if (base64Image) {
      activeSocket.emit('beautify_request', {
        image: base64Image,
        mode: aiMode,
      });
    }
    hasUnconvertedDrawing.current = false;
  };

  const handleClear = () => {
    if (socket?.connected) socket.emit('clear_canvas');
    clearCanvas();
    clearAutoConvertTimer();
    hasUnconvertedDrawing.current = false;
    pointerDrawingRef.current = false;
    pointerModeRef.current = 'draw';
    setPointer({ x: null, y: null, mode: 'idle' });
  };

  const handleManualBeautify = () => {
    clearAutoConvertTimer();
    triggerBeautify();
  };

  const handleAiModeChange = (_event, value) => {
    if (!value) return;
    setAiMode(value);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5', pb: 5, pt: 10 }}>
      <WhiteboardToolbar isConnected={isConnected} />

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
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={beginPointerStroke}
            onPointerMove={movePointerStroke}
            onPointerUp={endPointerStroke}
            onPointerCancel={endPointerStroke}
            onPointerLeave={endPointerStroke}
            onContextMenu={(event) => event.preventDefault()}
          />
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

          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleClear}>
              Clear board
            </Button>
            <Button variant="contained" color="primary" startIcon={<AutoAwesomeIcon />} onClick={handleManualBeautify} disabled={isProcessing}>
              Beautify now
            </Button>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={aiMode}
              onChange={handleAiModeChange}
              sx={{ ml: 'auto' }}
              color="primary"
            >
              <ToggleButton value="word">Word</ToggleButton>
              <ToggleButton value="phrase">Phrase</ToggleButton>
              <ToggleButton value="math">Math</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                  <SmartToyIcon sx={{ mr: 1, color: aiError ? '#ef4444' : (isProcessing ? '#8b5cf6' : '#64748b') }} />
                  {aiError ? 'AI error' : (isProcessing ? 'AI is processing...' : 'Status: Idle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                  {aiError
                    ? aiError
                    : (isProcessing
                      ? "Reading your handwriting via Vision AI..."
                      : "Write a word in the air and pause for 2 seconds.")}
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