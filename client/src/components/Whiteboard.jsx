import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useCanvas } from '../hooks/useCanvas';
import WhiteboardToolbar from './Toolbar';

// MUI Components
import { 
    Typography, Box, Paper, Button, 
    Container, Stack, Divider, List, ListItem, ListItemText 
} from '@mui/material';

// MUI Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GestureIcon from '@mui/icons-material/Gesture';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function Whiteboard() {
    const { canvasRef, draw, clearCanvas, drawBeautifulText, getCanvasImage } = useCanvas();
    const [isProcessing, setIsProcessing] = useState(false);
    const [socket, setSocket] = useState(null);
    const [recentWords, setRecentWords] = useState([]); // Store history of words
    
    const autoConvertTimeout = useRef(null);
    const hasUnconvertedDrawing = useRef(false);

    useEffect(() => {
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('draw_event', (data) => {
            draw(data);
            if (data.action === 'draw' || data.action === 'erase') {
                hasUnconvertedDrawing.current = true;
                if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
            } 
            else if (data.action === 'stop' || data.action === 'hover') {
                if (hasUnconvertedDrawing.current) {
                    if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
                    autoConvertTimeout.current = setTimeout(() => {
                        triggerBeautify(newSocket);
                    }, 2000); 
                }
            }
        });

        newSocket.on('clear_canvas', () => clearCanvas());
        newSocket.on('is_beautifying', (status) => setIsProcessing(status));
        
        newSocket.on('beautify_result', (beautifulText) => {
            drawBeautifulText(beautifulText);
            setRecentWords(prev => [beautifulText, ...prev].slice(0, 5)); // Keep last 5
        });

        newSocket.on('init_canvas', (history) => {
            history.forEach(data => draw(data));
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
        if (base64Image) {
            activeSocket.emit('beautify_request', base64Image);
        }
        hasUnconvertedDrawing.current = false;
    };

    const handleClear = () => {
        if (socket) socket.emit('clear_canvas');
        clearCanvas();
        if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
        hasUnconvertedDrawing.current = false;
    };

    const handleManualBeautify = () => {
        if (autoConvertTimeout.current) clearTimeout(autoConvertTimeout.current);
        triggerBeautify();
    };

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5', pb: 5, pt: 10 }}>
            {/* TOP NAVIGATION BAR */}
            <WhiteboardToolbar />

            <Container maxWidth="lg" sx={{ mt: 4 }}>
                
                {/* THE DRAWING CANVAS */}
                <Paper 
                    elevation={4} 
                    sx={{ 
                        width: '100%', 
                        height: '500px', 
                        overflow: 'hidden', 
                        borderRadius: 2,
                        mb: 4,
                        border: '2px solid #e2e8f0'
                    }}
                >
                    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />
                </Paper>

                {/* CAMERA PREVIEW */}

                {/* BOTTOM STUDIO PANEL */}
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
                        <Button 
                            variant="outlined" 
                            color="error" 
                            startIcon={<DeleteIcon />} 
                            onClick={handleClear}
                        >
                            Clear board
                        </Button>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            startIcon={<AutoAwesomeIcon />} 
                            onClick={handleManualBeautify}
                            disabled={isProcessing}
                        >
                            Beautify now
                        </Button>
                    </Stack>

                    <Divider sx={{ mb: 3 }} />

                    {/* STATUS AND RECENT HISTORY */}
                    <Box sx={{ display: 'flex', gap: 4 }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                                <SmartToyIcon sx={{ mr: 1, color: isProcessing ? '#8b5cf6' : '#64748b' }} />
                                {isProcessing ? 'AI is processing...' : 'Status: Idle'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {isProcessing 
                                    ? "Reading your handwriting via Vision AI..." 
                                    : "Write a word in the air and pause for 2 seconds."}
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