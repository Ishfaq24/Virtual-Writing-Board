require('dotenv').config();
const { OpenAI } = require('openai');
const Tesseract = require('tesseract.js');

// Initialize OpenAI (or NVIDIA-compatible OpenAI wrapper) using env vars.
// If OPENAI_BASE_URL is not set, default to the official OpenAI endpoint.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
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

// Utility: use Tesseract fallback to read base64 PNG/JPEG
async function tesseractRecognize(base64Image) {
  try {
    // strip data URL header if present and convert to Buffer
    const commaIndex = base64Image.indexOf(',');
    const payload = commaIndex >= 0 ? base64Image.slice(commaIndex + 1) : base64Image;
    const imageBuffer = Buffer.from(payload, 'base64');

    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      // optional Tesseract configs can go here
    });
    return (data && data.text) ? data.text.trim() : '';
  } catch (err) {
    console.error('[TESSERACT ERROR]', err);
    return '';
  }
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
    socket.on('beautify_request', async (payload) => {
      if (isBeautifying) {
        console.log('[AI] Skipping beautify request: already processing');
        return;
      }

      // Support both legacy string payload and new { image, mode } object
      let base64Image = null;
      let mode = 'word';
      if (typeof payload === 'string') {
        base64Image = payload;
      } else if (payload && typeof payload === 'object') {
        base64Image = payload.image;
        if (typeof payload.mode === 'string') {
          const rawMode = payload.mode.toLowerCase();
          if (['word', 'phrase', 'math'].includes(rawMode)) mode = rawMode;
        }
      }

      if (typeof base64Image !== 'string' || !base64Image.startsWith('data:image')) {
        console.warn('[AI] Ignoring invalid beautify_request payload');
        return;
      }
      // avoid extremely large payloads
      if (base64Image.length > 5 * 1024 * 1024) {
        console.warn('[AI] Image payload too large, skipping AI call');
        return;
      }

      console.log(`[AI] Processing image with vision model (mode=${mode})...`);
      isBeautifying = true;
      io.emit('is_beautifying', true);

      // prepare prompt text by mode
      let promptText =
        'You are a handwriting recognition expert. Read the word or letters drawn in this image. Return ONLY the text you see. Do not include any other words, punctuation, or explanations. If it is messy, use your best context to guess the intended English word.';
      if (mode === 'phrase') {
        promptText =
          'You are a handwriting recognition expert. Read the handwritten phrase or short sentence in this image. Return ONLY the phrase you see, with normal spacing and capitalization, and no extra commentary.';
      } else if (mode === 'math') {
        promptText =
          'You are a handwriting recognition expert for mathematics. Read the handwritten mathematical expression or equation in this image and return ONLY the expression, using plain text or LaTeX-like notation if helpful. Do not add explanations.';
      }

      let recognizedText = '';

      try {
        // Attempt the configured vision API first (OpenAI or NVIDIA-compatible)
        const response = await openai.chat.completions.create({
          model: process.env.VISION_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                { type: 'image_url', image_url: { url: base64Image } },
              ],
            },
          ],
          max_tokens: 80,
        });

        const choice = response?.choices?.[0];
        const content = choice?.message?.content;
        recognizedText = typeof content === 'string' ? content.trim() : '';

        console.log('[AI] Vision API responded:', recognizedText || '(empty)');
      } catch (err) {
        // Log error and if it's a 404 (endpoint mismatch) or other failure, fallback to Tesseract
        const errMsg = err?.message || err;
        console.error('[AI ERROR] Vision recognition call failed:', errMsg);

        // Fallback to Tesseract.js locally
        console.log('[AI] Falling back to local Tesseract OCR...');
        recognizedText = await tesseractRecognize(base64Image);
        console.log('[TESSERACT] Recognized:', recognizedText || '(empty)');
      } finally {
        // If we have recognized text, send it back and clear canvas history
        if (recognizedText && !recognizedText.toLowerCase().includes('sorry')) {
          canvasState = [];
          io.emit('beautify_result', recognizedText);
        } else if (!recognizedText) {
          // Notify clients there's no confident result
          io.emit('beautify_result', '');
        }

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