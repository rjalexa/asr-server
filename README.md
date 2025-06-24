# Whisper Streaming Demo

A Next.js application demonstrating real-time audio streaming with OpenAI Whisper transcription.

## Features

- 🎤 Real-time audio recording from browser
- 🔄 WebSocket streaming to backend
- 📝 Transcription using OpenAI's Whisper API
- 💬 Live transcript display with word count
- 🎯 Clean, modern UI with status indicators

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- OpenAI API key (for transcription)

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up your OpenAI API key:**
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env and add your OpenAI API key
   # Or set it directly:
   export OPENAI_API_KEY="sk-your-api-key-here"
   ```

   Get your API key from: https://platform.openai.com/api-keys

3. **Run the transcription server:**
   ```bash
   # Run the Whisper transcription server
   pnpm run server:whisper
   
   # Or use the default server command
   pnpm run server
   ```

4. **In a new terminal, run the Next.js dev server:**
   ```bash
   pnpm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:3000
   ```

## Usage

1. Click the "🎤 Start Recording" button
2. Allow microphone access when prompted
3. Speak clearly into your microphone
4. Watch as your speech is transcribed in real-time
5. Click "⏹ Stop Recording" when done
6. Use "Clear" to reset the transcript

## How It Works

1. **Frontend** (Next.js/React):
   - Captures audio using the Web Audio API
   - Streams audio chunks via WebSocket
   - Displays transcription results in real-time

2. **Backend** (Node.js/WebSocket):
   - Receives audio chunks from the frontend
   - Buffers audio data (2-second processing intervals)
   - Sends audio to OpenAI Whisper API
   - Streams transcription back to frontend

## Project Structure

```
whisper-streaming-demo/
├── pages/
│   ├── api/
│   ├── _app.js
│   └── index.js         # Main UI
├── server-whisper.mjs   # OpenAI Whisper server
├── next.config.mjs
├── package.json
├── .env.example
└── README.md
```

## Available Scripts

- `pnpm run dev` - Start Next.js development server
- `pnpm run dev:all` - Start both frontend and backend concurrently
- `pnpm run server` - Start the Whisper transcription server
- `pnpm run server:whisper` - Explicitly run Whisper server
- `pnpm run build` - Build the Next.js application for production
- `pnpm run start` - Start the production Next.js server

## Troubleshooting

### "OPENAI_API_KEY not set" warning
- Make sure you've set your OpenAI API key either in `.env` or as an environment variable
- Get a key from: https://platform.openai.com/api-keys

### No transcription appearing
- Check the server console for errors
- Ensure your microphone is working and permitted in the browser
- Verify your OpenAI API key is valid and has credits

### Audio not recording
- Check browser permissions for microphone access
- Try using Chrome or Edge for best compatibility
- Ensure no other application is using the microphone

## Configuration

The transcription server processes audio in 2-second chunks by default. You can modify this in `server-whisper.mjs` by changing the `PROCESS_INTERVAL` constant:

```javascript
const PROCESS_INTERVAL = 2000; // Change this value (in milliseconds)
```

## Security Notes

- Never commit your `.env` file or expose your API key
- The demo runs on localhost only by default
- For production, implement proper authentication and HTTPS

## License

MIT
