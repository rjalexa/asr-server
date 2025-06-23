// server-whisper-webm.mjs – revised 2025‑06‑23 (bug‑fix #2)
// • Ensures the correct Whisper model is used by reading WHISPER_MODEL envvar
//   (default: "whisper‑1"). Adds a console line each time we call the API so
//   mis‑matches are obvious.
// • No functional changes elsewhere.

import { WebSocketServer } from 'ws';
import { createServer }   from 'http';
import { dirname }        from 'path';
import { fileURLToPath }  from 'url';
import { spawn }          from 'child_process';
import { randomBytes }    from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port      = process.env.PORT ? Number(process.env.PORT) : 3001;
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';

// ─────────────────────────────────────────────────────────────────────────────
// 0.  Server + WebSocket bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const server = createServer();
const wss    = new WebSocketServer({ server });
const PROCESS_INTERVAL = 3_000; // ms

// ─────────────────────────────────────────────────────────────────────────────
// 1.  AudioCollector – keep whole stream to avoid EBML issues
// ─────────────────────────────────────────────────────────────────────────────
class AudioCollector {
  constructor () {
    this.chunks = [];
    this.bytes  = 0;
  }
  add (chunk) {
    this.chunks.push(chunk);
    this.bytes += chunk.byteLength;
  }
  getBuffer () {
    return this.chunks.length ? Buffer.concat(this.chunks) : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  WebSocket handler
// ─────────────────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);

  const sessionId      = randomBytes(8).toString('hex');
  const audioCollector = new AudioCollector();

  let timer   = null;
  let busy    = false;
  let chunkNr = 0;

  ws.on('message', data => {
    if (typeof data === 'string') return;  // ignore text frames
    audioCollector.add(data);
    if (!timer) timer = setInterval(processAudio, PROCESS_INTERVAL);
  });

  ws.on('close', () => {
    clearInterval(timer);
    console.log('Client disconnected');
  });

  async function processAudio () {
    if (busy) return;
    busy = true;
    try {
      const buffer = audioCollector.getBuffer();
      if (!buffer) return;

      const pcm16k = await convertWithFfmpeg(buffer);
      const transcript = await transcribeWithWhisper(pcm16k || buffer);

      chunkNr += 1;
      ws.send(JSON.stringify({ chunk_number: chunkNr, transcript, timestamp: Date.now() }));
      console.log(`Chunk #${chunkNr} sent (${(buffer.length/1024).toFixed(1)} KiB)`);
    } catch (err) {
      console.error('Error:', err);
      ws.send(JSON.stringify({ error: err.message, timestamp: Date.now() }));
    } finally { busy = false; }
  }
});

server.listen(port, () => console.log(`Server running at http://localhost:${port}`));

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg helper – WebM/Opus → 16‑kHz WAV (Whisper likes PCM 16 kHz mono)
// ─────────────────────────────────────────────────────────────────────────────
async function convertWithFfmpeg (inputBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'webm', '-i', 'pipe:0',
      '-ac', '1', '-ar', '16000',
      '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1',
    ]);

    const out = [];
    ffmpeg.stdin.end(inputBuffer);
    ffmpeg.stdout.on('data', c => out.push(c));

    let err = '';
    ffmpeg.stderr.on('data', d => (err += d));
    ffmpeg.on('close', c => (c === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`FFmpeg ${c}: ${err}`))));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Whisper helper – uploads audio and returns plain‑text transcript
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeWithWhisper (audioBuffer) {
  if (!process.env.OPENAI_API_KEY) {
    return '(OPENAI_API_KEY not set)';
  }
  console.log(`→ Whisper API (${WHISPER_MODEL}), ${(audioBuffer.length/1024).toFixed(1)} KiB`);

  const form = new FormData();
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'text');
  form.append('temperature', '0.0');
  form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  return res.headers.get('content-type')?.includes('text') ? await res.text() : (await res.json()).text;
}

