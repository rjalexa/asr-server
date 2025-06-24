# MP3 Recording & Transcription Demo

A Next.js application for MP3 audio recording and transcription using local Whisper.cpp processing.

## Features

- 🎤 High-quality MP3 audio recording from browser
- 🤖 Automatic transcription when recording stops
- 💾 Download audio files (MP3 format)
- 📄 Download transcribed text as .txt files
- 🎧 Audio preview with playback controls
- 🏠 Local transcription using Whisper.cpp (no API keys needed)
- 🎯 Clean, modern UI with status indicators

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)

## Quick Start

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
   http://localhost:3000
   ```

## Usage

1. Click the "🎤 Start Recording" button
2. Allow microphone access when prompted
3. Speak clearly into your microphone
4. Click "⏹ Stop Recording" when finished
5. Transcription will start automatically
6. Use "💾 Download audio" to save the MP3 file
7. Use "📄 Download text" to save the transcribed text as a .txt file
8. Use "Clear" to reset everything and start over

## How It Works

1. **Frontend** (Next.js/React):
   - Records high-quality MP3 audio files using MediaRecorder API
   - Automatically starts transcription when recording stops
   - Provides audio preview with playback controls
   - Offers download functionality for both audio and text

2. **Backend** (Next.js API):
   - Receives MP3 file uploads via multipart form data
   - Converts audio to WAV format using FFmpeg
   - Processes with local Whisper.cpp for transcription
   - Returns transcription results as JSON

## Project Structure

```
whisper-recording-demo/
├── components/
│   └── Navigation.js    # Simple navigation component
├── pages/
│   ├── api/
│   │   └── transcribe-local.js  # Local Whisper API endpoint
│   ├── _app.js
│   └── index.js         # Main MP3 recording & transcription UI
├── models/              # Whisper model files
│   └── ggml-small.bin   # Small model (~244MB)
├── setup-whisper.sh     # Whisper.cpp setup script
├── next.config.mjs
├── package.json
└── README.md
```

## Available Scripts

- `pnpm run dev` - Start Next.js development server
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

### Common Issues

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

#### Audio not recording
- Check browser permissions for microphone access
- Try using Chrome or Edge for best compatibility
- Ensure no other application is using the microphone

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

You can customize the Whisper.cpp transcription by modifying the API endpoint (`pages/api/transcribe-local.js`):

- **Language**: Change the `--language` parameter (currently set to 'it' for Italian)
- **Model**: Use different model sizes (tiny, small, medium, large)
- **Threads**: Adjust the `--threads` parameter for performance

## Security Notes

- The demo runs on localhost only by default
- For production, implement proper authentication and HTTPS
- Audio files are temporarily stored during processing and automatically cleaned up

## License

MIT
