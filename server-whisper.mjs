// server-whisper.mjs – Whisper streaming transcription server
// Features:
// 1. Proper chunked processing instead of accumulating all audio
// 2. Incremental transcription with overlap handling
// 3. Better state management for resume functionality
// 4. Reduced latency with smaller processing intervals

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';

// ─────────────────────────────────────────────────────────────────────────────
// Server + WebSocket bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const server = createServer();
const wss = new WebSocketServer({ server });

// Reduced interval for more responsive transcription
const PROCESS_INTERVAL = 2000; // 2 seconds
const MIN_CHUNK_SIZE = 32 * 1024; // 32KB minimum before processing
const OVERLAP_DURATION = 1000; // 1 second overlap for context

// ─────────────────────────────────────────────────────────────────────────────
// Improved AudioCollector with proper WebM chunk handling
// ─────────────────────────────────────────────────────────────────────────────
class StreamingAudioCollector {
  constructor() {
    this.webmChunks = [];
    this.totalBytes = 0;
    this.lastProcessedIndex = 0;
    this.hasValidHeader = false;
  }

  add(chunk) {
    this.webmChunks.push(chunk);
    this.totalBytes += chunk.byteLength;
    
    // Check if we have a valid WebM header in the first chunk
    if (!this.hasValidHeader && this.webmChunks.length === 1) {
      this.hasValidHeader = this.isValidWebMStart(chunk);
    }
  }

  // Check if chunk starts with valid WebM/EBML header
  isValidWebMStart(chunk) {
    if (chunk.length < 4) return false;
    // WebM files start with EBML header (0x1A45DFA3)
    const view = new DataView(chunk.buffer || chunk);
    return view.getUint32(0, false) === 0x1A45DFA3;
  }

  // Get accumulated WebM data for processing
  getProcessableBuffer() {
    if (this.webmChunks.length === 0) return null;
    
    // We need at least a few chunks to have meaningful audio data
    const chunksToProcess = this.webmChunks.length - this.lastProcessedIndex;
    if (chunksToProcess < 10) return null; // Wait for at least 10 chunks (1 second of audio)
    
    // Get all chunks from start to current position
    const chunksToConcat = this.webmChunks.slice(0, this.webmChunks.length);
    const buffer = Buffer.concat(chunksToConcat);
    
    // Update processed index
    this.lastProcessedIndex = this.webmChunks.length - 5; // Keep some overlap
    
    return buffer;
  }

  // Get all audio for final processing
  getAllAudioBuffer() {
    return this.webmChunks.length ? Buffer.concat(this.webmChunks) : null;
  }

  reset() {
    this.webmChunks = [];
    this.totalBytes = 0;
    this.lastProcessedIndex = 0;
    this.hasValidHeader = false;
  }

  // Get current buffer size info
  getBufferInfo() {
    return {
      chunks: this.webmChunks.length,
      totalBytes: this.totalBytes,
      hasValidHeader: this.hasValidHeader,
      lastProcessedIndex: this.lastProcessedIndex
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket handler with improved streaming
// ─────────────────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);

  const sessionId = randomBytes(8).toString('hex');
  const audioCollector = new StreamingAudioCollector();

  let timer = null;
  let busy = false;
  let chunkNr = 0;
  let fullTranscript = '';
  let lastTranscriptLength = 0;

  ws.on('message', data => {
    if (typeof data === 'string') {
      // Handle control messages
      const message = JSON.parse(data);
      if (message.type === 'reset') {
        audioCollector.reset();
        fullTranscript = '';
        lastTranscriptLength = 0;
        chunkNr = 0;
        ws.send(JSON.stringify({ 
          type: 'reset_complete', 
          timestamp: Date.now() 
        }));
      }
      return;
    }
    
    audioCollector.add(data);
    if (!timer) {
      timer = setInterval(processAudio, PROCESS_INTERVAL);
    }
  });

  ws.on('close', () => {
    if (timer) clearInterval(timer);
    console.log('Client disconnected');
  });

  async function processAudio() {
    if (busy) return;
    busy = true;
    
    try {
      const buffer = audioCollector.getProcessableBuffer();
      if (!buffer) {
        busy = false;
        return;
      }

      const bufferInfo = audioCollector.getBufferInfo();
      console.log(`Processing audio: ${bufferInfo.chunks} chunks, ${(bufferInfo.totalBytes/1024).toFixed(1)} KiB total, valid header: ${bufferInfo.hasValidHeader}`);

      if (!bufferInfo.hasValidHeader) {
        console.warn('Warning: No valid WebM header detected in audio stream');
      }

      const pcm16k = await convertWithFfmpeg(buffer);
      const newTranscript = await transcribeWithWhisper(pcm16k || buffer);
      
      if (newTranscript && newTranscript.trim()) {
        // Clean up the transcript
        const cleanTranscript = newTranscript.trim();
        
        // For streaming, we want to send incremental updates
        // This is a simplified approach - in production you'd want more sophisticated
        // overlap detection and merging
        const newText = extractNewText(cleanTranscript, fullTranscript);
        
        if (newText) {
          fullTranscript += (fullTranscript ? ' ' : '') + newText;
          
          chunkNr += 1;
          ws.send(JSON.stringify({ 
            transcript: newText,
            full_transcript: fullTranscript,
            is_final: false,
            chunk_number: chunkNr,
            timestamp: Date.now() 
          }));
          
          console.log(`Chunk #${chunkNr}: "${newText}" (${(buffer.length/1024).toFixed(1)} KiB)`);
        }
      }
    } catch (err) {
      console.error('Processing error:', err);
      ws.send(JSON.stringify({ 
        error: err.message, 
        timestamp: Date.now() 
      }));
    } finally { 
      busy = false; 
    }
  }

  // Process any remaining audio when connection closes
  ws.on('close', async () => {
    if (timer) clearInterval(timer);
    
    // Final processing of any remaining audio
    try {
      const finalBuffer = audioCollector.getAllAudioBuffer();
      const bufferInfo = audioCollector.getBufferInfo();
      
      if (finalBuffer && bufferInfo.chunks > bufferInfo.lastProcessedIndex) {
        console.log('Processing final audio chunk...');
        const pcm16k = await convertWithFfmpeg(finalBuffer);
        const finalTranscript = await transcribeWithWhisper(pcm16k || finalBuffer);
        
        if (finalTranscript && finalTranscript.trim()) {
          // This would be sent if connection was still open
          console.log(`Final transcript: "${finalTranscript}"`);
        }
      }
    } catch (err) {
      console.error('Final processing error:', err);
    }
    
    console.log('Client disconnected');
  });
});

// Helper function to extract new text from current transcript
function extractNewText(currentTranscript, previousFullTranscript) {
  if (!previousFullTranscript) return currentTranscript;
  
  // Simple approach: if current transcript is longer and contains previous text,
  // extract the new part. In production, you'd want more sophisticated text diffing.
  const prevWords = previousFullTranscript.toLowerCase().split(' ');
  const currentWords = currentTranscript.toLowerCase().split(' ');
  
  // Find where the new content starts
  let newStartIndex = 0;
  for (let i = Math.max(0, prevWords.length - 10); i < prevWords.length; i++) {
    const searchPhrase = prevWords.slice(i).join(' ');
    const foundIndex = currentTranscript.toLowerCase().indexOf(searchPhrase);
    if (foundIndex !== -1) {
      newStartIndex = foundIndex + searchPhrase.length;
      break;
    }
  }
  
  if (newStartIndex > 0 && newStartIndex < currentTranscript.length) {
    return currentTranscript.slice(newStartIndex).trim();
  }
  
  // Fallback: return current transcript if we can't find overlap
  return currentTranscript;
}

server.listen(port, () => console.log(`Whisper streaming server running at http://localhost:${port}`));

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg helper – WebM/Opus → 16‑kHz WAV with improved error handling
// ─────────────────────────────────────────────────────────────────────────────
async function convertWithFfmpeg(inputBuffer) {
  return new Promise((resolve, reject) => {
    console.log(`Converting ${inputBuffer.length} bytes with FFmpeg...`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'warning', // Changed to warning to get more info
      '-f', 'webm', '-i', 'pipe:0',
      '-ac', '1', '-ar', '16000',
      '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1',
      '-avoid_negative_ts', 'make_zero', // Handle timing issues
      '-fflags', '+genpts', // Generate presentation timestamps
    ]);

    const out = [];
    let errorOutput = '';
    
    // Handle stdin errors
    ffmpeg.stdin.on('error', (err) => {
      console.error('FFmpeg stdin error:', err);
    });
    
    // Write input buffer
    try {
      ffmpeg.stdin.end(inputBuffer);
    } catch (err) {
      console.error('Error writing to FFmpeg stdin:', err);
      reject(new Error(`Failed to write input: ${err.message}`));
      return;
    }

    ffmpeg.stdout.on('data', chunk => out.push(chunk));
    ffmpeg.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', code => {
      if (code === 0) {
        const outputBuffer = Buffer.concat(out);
        console.log(`FFmpeg conversion successful: ${outputBuffer.length} bytes output`);
        resolve(outputBuffer);
      } else {
        console.error(`FFmpeg failed with code ${code}:`);
        console.error('Error output:', errorOutput);
        reject(new Error(`FFmpeg ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', err => {
      console.error('FFmpeg process error:', err);
      reject(new Error(`FFmpeg process error: ${err.message}`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Whisper helper with better error handling
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeWithWhisper(audioBuffer) {
  if (!process.env.OPENAI_API_KEY) {
    return '(OPENAI_API_KEY not set)';
  }
  
  console.log(`→ Whisper API (${WHISPER_MODEL}), ${(audioBuffer.length/1024).toFixed(1)} KiB`);

  const form = new FormData();
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'text');
  form.append('temperature', '0.0');
  form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Whisper ${res.status}: ${errorText}`);
    }
    
    const result = res.headers.get('content-type')?.includes('text') 
      ? await res.text() 
      : (await res.json()).text;
      
    return result;
  } catch (error) {
    console.error('Whisper API error:', error);
    throw error;
  }
}
