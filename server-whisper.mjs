import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { writeFile, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = 3001;

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ server });

console.log('Starting Whisper WebSocket server...');

// Using OpenAI Whisper API
async function transcribeWithOpenAI(audioBuffer) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY environment variable');
    return null;
  }

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');
  formData.append('language', 'en'); // Optional: specify language

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

wss.on('connection', (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);
  
  const sessionId = Date.now().toString();
  let audioChunks = [];
  let processingInterval;
  let isProcessing = false;
  
  ws.on('message', async (data) => {
    // Collect audio chunks
    audioChunks.push(data);
    const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    console.log(`Received chunk: ${data.byteLength} bytes (total buffered: ${totalSize} bytes)`);
    
    // Start processing interval on first chunk
    if (!processingInterval) {
      processingInterval = setInterval(async () => {
        // Skip if already processing or no chunks
        if (isProcessing || audioChunks.length === 0) return;
        
        isProcessing = true;
        
        try {
          // Combine audio chunks
          const audioBuffer = Buffer.concat(audioChunks);
          const bufferSize = audioBuffer.length;
          
          // Clear chunks for next batch
          audioChunks = [];
          
          // Skip if buffer is too small (less than ~1 second of audio)
          if (bufferSize < 10000) {
            isProcessing = false;
            return;
          }
          
          console.log(`Processing ${bufferSize} bytes of audio...`);
          
          // Send status update
          ws.send(JSON.stringify({
            status: 'Processing audio...',
            timestamp: Date.now()
          }));
          
          // Transcribe with OpenAI
          const transcription = await transcribeWithOpenAI(audioBuffer);
          
          if (transcription && transcription.trim()) {
            ws.send(JSON.stringify({
              transcript: transcription,
              timestamp: Date.now(),
              is_final: true
            }));
            console.log('Sent transcription:', transcription);
            
            ws.send(JSON.stringify({
              status: 'Listening...',
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          console.error('Processing error:', error);
          ws.send(JSON.stringify({
            status: 'Error processing audio',
            timestamp: Date.now()
          }));
        } finally {
          isProcessing = false;
        }
      }, 3000); // Process every 3 seconds
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    
    if (processingInterval) {
      clearInterval(processingInterval);
    }
    
    // Process any remaining chunks
    if (audioChunks.length > 0 && !isProcessing) {
      const audioBuffer = Buffer.concat(audioChunks);
      if (audioBuffer.length > 10000) {
        transcribeWithOpenAI(audioBuffer).then(transcription => {
          if (transcription) {
            console.log('Final transcription:', transcription);
          }
        });
      }
    }
    
    audioChunks = [];
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Whisper WebSocket server is running on ws://localhost:${port}/stream`);
  console.log('Using OpenAI Whisper API');
  console.log('Press Ctrl+C to stop the server');
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('\n⚠️  Warning: OPENAI_API_KEY environment variable not set!');
    console.warn('To use real transcription, set your OpenAI API key:');
    console.warn('export OPENAI_API_KEY="sk-your-api-key-here"\n');
    console.warn('Get your API key from: https://platform.openai.com/api-keys\n');
  } else {
    console.log('\n✅ OpenAI API key detected');
  }
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

// Keep the process running
process.stdin.resume();
