# Whisper Streaming Demo

A Next.js application demonstrating two different approaches to audio transcription with Whisper:

1. **Streaming Demo**: Real-time audio streaming with OpenAI Whisper API
2. **MP3 Recording Demo**: Complete MP3 recording with local Whisper.cpp processing

## Features

### Streaming Demo (OpenAI Whisper)
- 🎤 Real-time audio recording from browser
- 🔄 WebSocket streaming to backend
- 📝 Transcription using OpenAI's Whisper API
- 💬 Live transcript display with word count
- 🎯 Clean, modern UI with status indicators

### MP3 Recording Demo (Local Whisper)
- 🎵 MP3 audio recording (15-second limit)
- 📁 Complete file upload after recording
- 🏠 Local transcription using Whisper.cpp
- 💾 Audio download functionality
- ⏱️ Visual countdown timer
- 🎧 Audio preview with playback controls

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- OpenAI API key (for transcription)

## Quick Start

### For Streaming Demo (OpenAI Whisper)

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

### For MP3 Recording Demo (Local Whisper)

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Install Whisper.cpp (choose your platform):**

   #### Option A: Automated Setup (Recommended)
   ```bash
   # Run the automated setup script (macOS/Linux)
   pnpm run setup:whisper
   ```

   #### Option B: Manual Installation

   **macOS (using Homebrew):**
   ```bash
   # Install whisper.cpp via Homebrew
   brew install whisper-cpp
   
   # Create symlink to the demo (whisper.cpp installs as 'whisper')
   ln -sf $(which whisper) ./whisper
   
   # Download the model
   mkdir -p models
   curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
   ```

   **macOS (building from source):**
   ```bash
   # Clone and build whisper.cpp
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp
   make
   
   # Create symlink to the demo
   ln -sf $(pwd)/main ../whisper
   cd ..
   
   # Download the model
   mkdir -p models
   curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   # Install build dependencies
   sudo apt update
   sudo apt install build-essential git
   
   # Clone and build whisper.cpp
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp
   make
   
   # Create symlink to the demo
   ln -sf $(pwd)/main ../whisper
   cd ..
   
   # Download the model
   mkdir -p models
   curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
   ```

   **Linux (Arch Linux):**
   ```bash
   # Install from AUR (if available)
   yay -S whisper.cpp
   
   # Or build from source (same as Ubuntu instructions above)
   # Then create symlink
   ln -sf /usr/bin/whisper ./whisper
   
   # Download the model
   mkdir -p models
   curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
   ```

3. **Install FFmpeg (required for audio conversion):**
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # Arch Linux
   sudo pacman -S ffmpeg
   
   # CentOS/RHEL/Fedora
   sudo dnf install ffmpeg
   ```

4. **Verify your installation:**
   ```bash
   # Check if whisper executable is accessible
   ./whisper --help
   
   # Check if model file exists
   ls -la models/ggml-small.bin
   
   # Check FFmpeg
   ffmpeg -version
   ```

5. **Run the Next.js dev server:**
   ```bash
   pnpm run dev
   ```

6. **Open your browser:**
   ```
   http://localhost:3000/demo2
   ```

## Usage

### Streaming Demo
1. Click the "🎤 Start Recording" button
2. Allow microphone access when prompted
3. Speak clearly into your microphone
4. Watch as your speech is transcribed in real-time
5. Click "⏸ Pause Recording" to pause or "▶ Resume Recording" to continue
6. Use "Clear" to reset the transcript

### MP3 Recording Demo
1. Click the "🎤 Start Recording" button
2. Allow microphone access when prompted
3. Speak clearly into your microphone (15-second limit)
4. Recording stops automatically or click "⏹ Stop Recording"
5. Click "📝 Transcribe" to process the audio with local Whisper
6. Use "💾 Download" to save the MP3 file
7. Use "Clear" to reset everything

## How It Works

### Streaming Demo (OpenAI)
1. **Frontend** (Next.js/React):
   - Captures audio using the Web Audio API
   - Streams audio chunks via WebSocket
   - Displays transcription results in real-time

2. **Backend** (Node.js/WebSocket):
   - Receives audio chunks from the frontend
   - Buffers audio data (2-second processing intervals)
   - Sends audio to OpenAI Whisper API
   - Streams transcription back to frontend

### MP3 Recording Demo (Local)
1. **Frontend** (Next.js/React):
   - Records complete MP3 audio files (15-second limit)
   - Uploads finished recording to API endpoint
   - Displays audio preview and transcription results

2. **Backend** (Next.js API):
   - Receives MP3 file uploads
   - Converts audio to WAV format using FFmpeg
   - Processes with local Whisper.cpp
   - Returns transcription results

## Project Structure

```
whisper-streaming-demo/
├── components/
│   └── Navigation.js    # Navigation between demos
├── pages/
│   ├── api/
│   │   └── transcribe-local.js  # Local Whisper API endpoint
│   ├── _app.js
│   ├── index.js         # Streaming demo UI
│   └── demo2.js         # MP3 recording demo UI
├── models/              # Whisper model files
│   └── ggml-small.bin   # Small model (~244MB)
├── server-whisper.mjs   # OpenAI Whisper streaming server
├── setup-whisper.sh     # Whisper.cpp setup script
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
- `pnpm run setup:whisper` - Set up Whisper.cpp and download model
- `pnpm run build` - Build the Next.js application for production
- `pnpm run start` - Start the production Next.js server

## Customizing the Whisper.cpp Symlink

The demo uses a symbolic link `./whisper` to point to your whisper.cpp executable. This allows the API to find and run whisper.cpp regardless of where it's installed on your system.

### Understanding the Symlink Setup

The API endpoint (`pages/api/transcribe-local.js`) looks for the whisper executable at `./whisper` (relative to the project root). This symlink should point to your actual whisper.cpp installation.

### Manual Symlink Configuration

If you need to customize or fix the symlink:

```bash
# Remove existing symlink (if any)
rm -f ./whisper

# Create new symlink - choose the appropriate option:

# Option 1: If whisper.cpp was installed via Homebrew (macOS)
ln -sf $(which whisper) ./whisper

# Option 2: If you built from source in a subdirectory
ln -sf ./whisper.cpp/main ./whisper

# Option 3: If whisper.cpp is installed system-wide (Linux)
ln -sf /usr/bin/whisper ./whisper
ln -sf /usr/local/bin/whisper ./whisper  # Alternative location

# Option 4: Custom installation path
ln -sf /path/to/your/whisper/executable ./whisper
```

### Verifying the Symlink

```bash
# Check if symlink exists and where it points
ls -la ./whisper

# Test if the executable works
./whisper --help

# Check if it can find the model
./whisper -m ./models/ggml-small.bin --help
```

### Common Symlink Issues

**Symlink points to wrong location:**
```bash
# Check where the symlink currently points
readlink ./whisper

# Update it to the correct location
ln -sf /correct/path/to/whisper ./whisper
```

**Permission issues:**
```bash
# Make sure the target executable has execute permissions
chmod +x /path/to/whisper/executable

# Recreate the symlink
ln -sf /path/to/whisper/executable ./whisper
```

**Whisper executable not found:**
```bash
# Find where whisper.cpp is installed
which whisper
find /usr -name "whisper" 2>/dev/null
find /usr/local -name "whisper" 2>/dev/null

# Create symlink to the found location
ln -sf /found/path/whisper ./whisper
```

## Troubleshooting

### Streaming Demo Issues

#### "OPENAI_API_KEY not set" warning
- Make sure you've set your OpenAI API key either in `.env` or as an environment variable
- Get a key from: https://platform.openai.com/api-keys

#### No transcription appearing
- Check the server console for errors
- Ensure your microphone is working and permitted in the browser
- Verify your OpenAI API key is valid and has credits

#### Audio not recording
- Check browser permissions for microphone access
- Try using Chrome or Edge for best compatibility
- Ensure no other application is using the microphone

### MP3 Recording Demo Issues

#### "Whisper.cpp not available" error
- Run the setup script: `pnpm run setup:whisper`
- Manually install whisper.cpp: `brew install whisper-cpp` (macOS)
- Ensure the model file exists at `./models/ggml-small.bin`

#### "FFmpeg failed" error
- Install FFmpeg: `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Ubuntu)
- Ensure FFmpeg is in your system PATH

#### Local transcription not working
- Check that whisper.cpp executable is accessible
- Verify the model file is downloaded and not corrupted
- Check server console for detailed error messages

#### MP3 recording not supported
- The browser will fallback to WebM format automatically
- This is normal and the transcription will still work

#### Symlink issues
- **Broken symlink**: Run `ls -la ./whisper` to check if the symlink is broken (shows in red)
- **Wrong target**: Use `readlink ./whisper` to see where it points, then recreate with correct path
- **No execute permission**: Run `chmod +x ./whisper` or fix permissions on the target executable
- **Symlink not found**: The `./whisper` file doesn't exist - follow the symlink creation steps above

#### Platform-specific issues

**macOS:**
- If Homebrew installation fails, try: `brew update && brew install whisper-cpp`
- For Apple Silicon Macs, whisper.cpp should automatically use optimized builds
- If you get permission errors, try: `sudo xcode-select --install`

**Linux:**
- On older Ubuntu versions, you may need to install `cmake`: `sudo apt install cmake`
- For GPU acceleration (if available), build with: `make WHISPER_CUBLAS=1`
- If you get "command not found" errors, ensure `/usr/local/bin` is in your PATH

**General:**
- Model download fails: Try using `wget` instead of `curl`, or download manually from the HuggingFace link
- Out of memory errors: Try using the `tiny` model instead: `ggml-tiny.bin` (~39MB)
- Slow transcription: The `small` model balances speed and accuracy; use `tiny` for faster results

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
