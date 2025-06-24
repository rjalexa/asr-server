#!/bin/bash

echo "🐳 Migrating Whisper Streaming Demo to Docker"
echo "=============================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Backup old files if they exist
if [ -d "whisper.cpp" ] || [ -f "whisper" ] || [ -d "models" ]; then
    echo "📦 Backing up old Whisper.cpp files..."
    mkdir -p backup/$(date +%Y%m%d_%H%M%S)
    
    [ -d "whisper.cpp" ] && mv whisper.cpp backup/$(date +%Y%m%d_%H%M%S)/
    [ -f "whisper" ] && mv whisper backup/$(date +%Y%m%d_%H%M%S)/
    [ -d "models" ] && mv models backup/$(date +%Y%m%d_%H%M%S)/
    [ -f "setup-whisper.sh" ] && mv setup-whisper.sh backup/$(date +%Y%m%d_%H%M%S)/
    
    echo "✅ Old files backed up to backup/ directory"
fi

# Set up environment file
if [ ! -f ".env.development" ]; then
    echo "⚙️  Setting up development environment..."
    cp .env.example .env.development
    echo "✅ Created .env.development"
else
    echo "ℹ️  .env.development already exists"
fi

# Test Docker setup
echo "🧪 Testing Docker setup..."
if docker info &> /dev/null; then
    echo "✅ Docker daemon is running"
else
    echo "❌ Docker daemon is not running. Please start Docker first."
    exit 1
fi

echo ""
echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "1. Start development environment:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up"
echo ""
echo "2. Or use npm scripts:"
echo "   npm run docker:dev"
echo ""
echo "3. Access the application at:"
echo "   http://localhost:3000"
echo ""
echo "For production deployment, see README.md"
