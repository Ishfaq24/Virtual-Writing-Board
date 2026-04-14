require('dotenv').config();
const { OpenAI } = require('openai');

// Initialize OpenAI using NVIDIA's base URL and your NVAPI key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL, // Crucial for routing to Nvidia
});

module.exports = (io) => {
    let canvasState = []; 
    let logCounter = 0;   

    io.on('connection', (socket) => {
        console.log(`[+] User/Client connected: ${socket.id}`);
        socket.emit('init_canvas', canvasState);

        socket.on('gesture_data', (data) => {
            logCounter++;
            if (logCounter % 30 === 0) {
                console.log(`[DATA] Action: ${data.action} | X: ${data.x}, Y: ${data.y}`);
            }
            io.emit('draw_event', data);
            
            if (['draw', 'erase', 'stop', 'hover'].includes(data.action)) {
                canvasState.push(data);
                if(canvasState.length > 50000) canvasState.shift(); 
            }
        });

        // 🧠 NVIDIA Llama 3.2 Vision Handwriting Recognition
        socket.on('beautify_request', async (base64Image) => {
            console.log(`[AI] Processing image with NVIDIA Vision API...`);
            io.emit('is_beautifying', true);

            try {
                const response = await openai.chat.completions.create({
                    // Must use a Vision model hosted by Nvidia!
                    model: "meta/llama-3.2-90b-vision-instruct", 
                    messages: [
                        {
                            role: "user",
                            content: [
                                { 
                                    type: "text", 
                                    text: "You are a handwriting recognition expert. Read the word or letters drawn in this image. Return ONLY the text you see. Do not include any other words, punctuation, or explanations. If it is messy, use your best context to guess the intended English word." 
                                },
                                { 
                                    type: "image_url", 
                                    image_url: { url: base64Image } 
                                }
                            ]
                        }
                    ],
                    max_tokens: 50,
                });

                const cleanText = response.choices[0].message.content.trim();
                console.log(`[AI] NVIDIA Recognized Text: "${cleanText}"`);

                if (cleanText.length > 0 && !cleanText.toLowerCase().includes('sorry')) {
                    canvasState = [];
                    io.emit('beautify_result', cleanText);
                }
            } catch (error) {
                console.error('[AI ERROR] NVIDIA Vision Failed:', error.message);
            } finally {
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