// server-whisper-fixed.mjs
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

console.log('Starting Whisper WebSocket server (with fixes)...');

// Configuration
const MAX_BUFFER_SIZE = 25 * 1024 * 1024; // 25MB max (OpenAI limit)
const PROCESS_INTERVAL = 3000; // Process every 3 seconds
const MIN_AUDIO_SIZE = 10000; // Minimum 10KB for processing
const MAX_SILENCE_DURATION = 10000; // 10 seconds max silence

// Using OpenAI Whisper API with better error handling
async function transcribeWithOpenAI(audioBuffer, sessionId) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY environment variable');
    return { error: 'No API key configured' };
  }

  // Check audio size
  if (audioBuffer.length > MAX_BUFFER_SIZE) {
    console.warn(`Audio buffer too large: ${audioBuffer.length} bytes, truncating...`);
    audioBuffer = audioBuffer.slice(0, MAX_BUFFER_SIZE);
  }

  try {
    // Save audio temporarily to check if it's valid
    const tempFile = join(__dirname, `temp_${sessionId}.webm`);
    await writeFile(tempFile, audioBuffer);
    
    // Create form data
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    formData.append('language', 'en');

    console.log(`Sending ${audioBuffer.length} bytes to OpenAI...`);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData
    });

    // Clean up temp file
    await unlink(tempFile).catch(() => {});

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      
      // Parse specific error types
      if (response.status === 400 && errorText.includes('audio file')) {
        return { error: 'Invalid audio format' };
      }
      if (response.status === 413) {
        return { error: 'Audio file too large' };
      }
      if (response.status === 429) {
        return { error: 'Rate limit exceeded' };
      }
      
      return { error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { text: data.text };
  } catch (error) {
    console.error('Transcription error:', error.message);
    return { error: error.message };
  }
}

wss.on('connection', (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);
  
  const sessionId = Date.now().toString();
  let audioChunks = [];
  let processingInterval;
  let isProcessing = false;
  let lastChunkTime = Date.now();
  let totalBytesReceived = 0;
  let chunksProcessed = 0;
  
  // Send initial status
  ws.send(JSON.stringify({
    status: 'Connected. Ready to record.',
    timestamp: Date.now()
  }));
  
  ws.on('message', async (data) => {
    const chunkSize = data.byteLength || data.length;
    lastChunkTime = Date.now();
    
    // Check if we're getting data
    if (chunkSize === 0) {
      console.log('Received empty chunk, skipping...');
      return;
    }
    
    // Add chunk to buffer
    audioChunks.push(data);
    totalBytesReceived += chunkSize;
    
    // Calculate current buffer size
    const currentBufferSize = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    
    console.log(`Received chunk: ${chunkSize} bytes (buffer: ${currentBufferSize} bytes, total: ${totalBytesReceived} bytes)`);
    
    // Check if buffer is getting too large
    if (currentBufferSize > MAX_BUFFER_SIZE * 0.8) {
      console.warn('Buffer approaching limit, forcing process...');
      processAudioBuffer();
    }
    
    // Start processing interval on first chunk
    if (!processingInterval) {
      processingInterval = setInterval(async () => {
        const timeSinceLastChunk = Date.now() - lastChunkTime;
        
        // Check for silence timeout
        if (timeSinceLastChunk > MAX_SILENCE_DURATION && audioChunks.length > 0) {
          console.log('Silence detected, processing remaining audio...');
          await processAudioBuffer();
          return;
        }
        
        // Regular processing
        if (!isProcessing && audioChunks.length > 0) {
          await processAudioBuffer();
        }
      }, PROCESS_INTERVAL);
    }
  });
  
  async function processAudioBuffer() {
    if (isProcessing || audioChunks.length === 0) return;
    
    isProcessing = true;
    
    try {
      // Combine audio chunks
      const audioBuffer = Buffer.concat(audioChunks);
      const bufferSize = audioBuffer.length;
      
      // Clear chunks for next batch
      audioChunks = [];
      
      // Skip if buffer is too small
      if (bufferSize < MIN_AUDIO_SIZE) {
        console.log(`Buffer too small (${bufferSize} bytes), skipping...`);
        isProcessing = false;
        return;
      }
      
      chunksProcessed++;
      console.log(`Processing chunk #${chunksProcessed}: ${bufferSize} bytes...`);
      
      // Send status update
      ws.send(JSON.stringify({
        status: `Processing audio chunk #${chunksProcessed}...`,
        timestamp: Date.now()
      }));
      
      // Transcribe with OpenAI
      const result = await transcribeWithOpenAI(audioBuffer, sessionId);
      
      if (result.error) {
        console.error('Transcription error:', result.error);
        ws.send(JSON.stringify({
          status: `Error: ${result.error}`,
          error: true,
          timestamp: Date.now()
        }));
      } else if (result.text && result.text.trim()) {
        ws.send(JSON.stringify({
          transcript: result.text,
          timestamp: Date.now(),
          is_final: true,
          chunk_number: chunksProcessed
        }));
        console.log(`Chunk #${chunksProcessed} transcribed:`, result.text);
        
        ws.send(JSON.stringify({
          status: 'Listening...',
          timestamp: Date.now()
        }));
      } else {
        console.log('No speech detected in chunk');
        ws.send(JSON.stringify({
          status: 'No speech detected',
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Processing error:', error);
      ws.send(JSON.stringify({
        status: 'Error processing audio',
        error: true,
        timestamp: Date.now()
      }));
    } finally {
      isProcessing = false;
    }
  }
  
  ws.on('close', async () => {
    console.log(`Client disconnected after receiving ${totalBytesReceived} bytes in ${chunksProcessed} chunks`);
    
    if (processingInterval) {
      clearInterval(processingInterval);
    }
    
    // Process any remaining chunks
    if (audioChunks.length > 0 && !isProcessing) {
      console.log('Processing final chunks before disconnect...');
      await processAudioBuffer();
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
  console.log('Using OpenAI Whisper API with improved error handling');
  console.log('Press Ctrl+C to stop the server');
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('\n⚠️  Warning: OPENAI_API_KEY environment variable not set!');
    console.warn('To use real transcription, set your OpenAI API key:');
    console.warn('export OPENAI_API_KEY="sk-your-api-key-here"\n');
    console.warn('Get your API key from: https://platform.openai.com/api-keys\n');
  } else {
    console.log('\n✅ OpenAI API key detected');
    console.log(`📊 Configuration:`);
    console.log(`   - Max buffer size: ${MAX_BUFFER_SIZE / 1024 / 1024}MB`);
    console.log(`   - Process interval: ${PROCESS_INTERVAL / 1000}s`);
    console.log(`   - Min audio size: ${MIN_AUDIO_SIZE / 1000}KB`);
    console.log(`   - Max silence: ${MAX_SILENCE_DURATION / 1000}s\n`);
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
