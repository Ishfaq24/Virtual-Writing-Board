require('dotenv').config();
const { OpenAI } = require('openai');

// Initialize OpenAI (or NVIDIA-compatible OpenAI wrapper) using env vars
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

// helper to validate and normalize gestures from the CV module
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

      // realtime broadcast for low-latency drawing on clients
      io.emit('draw_event', payload);

      // store history (including stop/hover) to avoid straight-line playback bug
      if (['draw', 'erase', 'stop', 'hover'].includes(payload.action)) {
        canvasState.push(payload);
        if (canvasState.length > 50000) canvasState.shift();
      }
    });

    // AI / Vision beautify request
    socket.on('beautify_request', async (base64Image) => {
      if (isBeautifying) return; // simple debounce
      if (typeof base64Image !== 'string' || !base64Image.startsWith('data:image')) {
        console.warn('[AI] Ignoring invalid beautify_request payload');
        return;
      }
      // avoid extremely large payloads
      if (base64Image.length > 5 * 1024 * 1024) {
        console.warn('[AI] Image payload too large, skipping AI call');
        return;
      }

      console.log('[AI] Processing image with vision model...');
      isBeautifying = true;
      io.emit('is_beautifying', true);

      try {
        // Using Chat Completions with image payload (NVIDIA integration or OpenAI wrapper)
        const response = await openai.chat.completions.create({
          model: process.env.VISION_MODEL || 'gpt-4o-mini', // override via .env if needed
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    'You are a handwriting recognition expert. Read the word or letters drawn in this image. Return ONLY the text you see. Do not include any other words, punctuation, or explanations. If it is messy, use your best context to guess the intended English word.',
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

        console.log(`[AI] Recognized Text: "${cleanText}"`);

        if (cleanText && !cleanText.toLowerCase().includes('sorry')) {
          // treat beautify as replacement: clear coordinate history and broadcast text
          canvasState = [];
          io.emit('beautify_result', cleanText);
        }
      } catch (error) {
        console.error('[AI ERROR] Vision recognition failed:', error?.message || error);
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