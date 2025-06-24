#!/bin/bash

# Whisper.cpp Setup Script for MP3 Recording Demo
# This script downloads and sets up whisper.cpp with the small model

set -e

echo "🎤 Setting up Whisper.cpp for local transcription..."

# Create models directory
mkdir -p models

# Check if whisper.cpp is already installed
if command -v whisper &> /dev/null; then
    echo "✅ Whisper.cpp already installed"
else
    echo "📥 Installing whisper.cpp..."
    
    # Check if we're on macOS with Homebrew
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
        echo "🍺 Installing via Homebrew..."
        brew install whisper-cpp
    else
        echo "🔧 Building from source..."
        
        # Clone whisper.cpp repository
        if [ ! -d "whisper.cpp" ]; then
            git clone https://github.com/ggerganov/whisper.cpp.git
        fi
        
        cd whisper.cpp
        
        # Build whisper.cpp
        make
        
        # Copy binary to project root
        cp main ../whisper
        
        cd ..
        
        echo "✅ Whisper.cpp built successfully"
    fi
fi

# Download the small model if it doesn't exist
MODEL_FILE="models/ggml-small.bin"
if [ ! -f "$MODEL_FILE" ]; then
    echo "📥 Downloading Whisper small model (~244MB)..."
    
    # Try to download from official repository
    MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
    
    if command -v curl &> /dev/null; then
        curl -L -o "$MODEL_FILE" "$MODEL_URL"
    elif command -v wget &> /dev/null; then
        wget -O "$MODEL_FILE" "$MODEL_URL"
    else
        echo "❌ Neither curl nor wget found. Please install one of them."
        exit 1
    fi
    
    echo "✅ Model downloaded successfully"
else
    echo "✅ Whisper small model already exists"
fi

# Verify the setup
echo "🔍 Verifying setup..."

if [ -f "$MODEL_FILE" ]; then
    MODEL_SIZE=$(du -h "$MODEL_FILE" | cut -f1)
    echo "✅ Model file: $MODEL_FILE ($MODEL_SIZE)"
else
    echo "❌ Model file not found"
    exit 1
fi

if command -v whisper &> /dev/null; then
    echo "✅ Whisper.cpp executable found"
elif [ -f "./whisper" ]; then
    echo "✅ Local whisper executable found"
else
    echo "❌ Whisper executable not found"
    exit 1
fi

echo ""
echo "🎉 Setup complete! You can now use the MP3 Recording Demo."
echo ""
echo "📋 Next steps:"
echo "1. Install Node.js dependencies: pnpm install"
echo "2. Start the development server: pnpm run dev"
echo "3. Open http://localhost:3000/demo2 in your browser"
echo ""
echo "💡 Note: Make sure FFmpeg is installed for audio conversion:"
echo "   - macOS: brew install ffmpeg"
echo "   - Ubuntu: sudo apt install ffmpeg"
echo "   - Windows: Download from https://ffmpeg.org/"
