require('dotenv').config();
const { OpenAI } = require('openai');

// Initialize OpenAI using NVIDIA's base URL and your NVAPI key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL, // Crucial for routing to Nvidia
});

// Simple helper to validate and normalize gestures from the CV module
function normalizeGesturePayload(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const allowedActions = new Set(['draw', 'erase', 'stop', 'hover']);
    const action = typeof raw.action === 'string' ? raw.action.toLowerCase() : '';
    if (!allowedActions.has(action)) return null;

    const x = typeof raw.x === 'number' ? raw.x : null;
    const y = typeof raw.y === 'number' ? raw.y : null;
    let normalizedX = typeof raw.normalizedX === 'number' ? raw.normalizedX : null;
    let normalizedY = typeof raw.normalizedY === 'number' ? raw.normalizedY : null;

    if (normalizedX !== null) normalizedX = Math.min(1, Math.max(0, normalizedX));
    if (normalizedY !== null) normalizedY = Math.min(1, Math.max(0, normalizedY));

    return {
        action,
        x,
        y,
        normalizedX,
        normalizedY,
    };
}

module.exports = (io) => {
    let canvasState = [];
    let logCounter = 0;
    let isBeautifying = false;

    io.on('connection', (socket) => {
        console.log(`[+] User/Client connected: ${socket.id}`);
        socket.emit('init_canvas', canvasState);

        socket.on('gesture_data', (data) => {
            const payload = normalizeGesturePayload(data);
            if (!payload) return;

            logCounter++;
            if (logCounter % 30 === 0) {
                console.log(`[DATA] Action: ${payload.action} | X: ${payload.x}, Y: ${payload.y}`);
            }

            io.emit('draw_event', payload);

            if (['draw', 'erase', 'stop', 'hover'].includes(payload.action)) {
                canvasState.push(payload);
                if (canvasState.length > 50000) canvasState.shift();
            }
        });

        // 🧠 NVIDIA Llama 3.2 Vision Handwriting Recognition
        socket.on('beautify_request', async (base64Image) => {
            if (isBeautifying) {
                // Ignore additional requests while one is in flight to avoid overload
                return;
            }

            if (typeof base64Image !== 'string' || !base64Image.startsWith('data:image')) {
                console.warn('[AI] Ignoring invalid beautify_request payload');
                return;
            }

            // Basic safeguard against extremely large payloads
            if (base64Image.length > 5 * 1024 * 1024) {
                console.warn('[AI] Image payload too large, skipping AI call');
                return;
            }

            console.log('[AI] Processing image with NVIDIA Vision API...');
            isBeautifying = true;
            io.emit('is_beautifying', true);

            try {
                const response = await openai.chat.completions.create({
                    // Must use a Vision model hosted by Nvidia!
                    model: 'meta/llama-3.2-90b-vision-instruct',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'You are a handwriting recognition expert. Read the word or letters drawn in this image. Return ONLY the text you see. Do not include any other words, punctuation, or explanations. If it is messy, use your best context to guess the intended English word.',
                                },
                                {
                                    type: 'image_url',
                                    image_url: { url: base64Image },
                                },
                            ],
                        },
                    ],
                    max_tokens: 50,
                });

                const choice = response?.choices?.[0];
                const content = choice?.message?.content;
                const cleanText = typeof content === 'string' ? content.trim() : '';

                console.log(`[AI] NVIDIA Recognized Text: "${cleanText}"`);

                if (cleanText && !cleanText.toLowerCase().includes('sorry')) {
                    canvasState = [];
                    io.emit('beautify_result', cleanText);
                }
            } catch (error) {
                console.error('[AI ERROR] NVIDIA Vision Failed:', error?.message || error);
            } finally {
                isBeautifying = false;
                io.emit('is_beautifying', false);
            }
        });

        socket.on('clear_canvas', () => {
            canvasState = [];
            io.emit('clear_canvas');
            console.log('[!] Canvas cleared');
        });

        socket.on('disconnect', () => {
            console.log(`[-] User/Client disconnected: ${socket.id}`);
        });
    });
};