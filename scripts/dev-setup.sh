#!/bin/bash

# ASR Server - Development Environment Setup Script
# This script sets up and runs the ASR server for local development

set -e

echo "🚀 ASR Server - Development Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo ""
    echo "🔍 Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "  macOS: brew install --cask docker"
        echo "  Ubuntu/Debian: sudo apt-get install docker.io docker-compose-plugin"
        exit 1
    fi
    print_status "Docker is installed"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    print_status "Docker Compose is available"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_status "Docker is running"
}

# Check API keys
check_api_keys() {
    echo ""
    echo "🔑 Checking API keys..."
    
    if [ ! -f ".secrets" ]; then
        print_warning ".secrets file not found. Creating template..."
        cat > .secrets << EOF
# ASR API Keys - Replace with your actual keys
ASR_API_KEY_1=asr_dev_$(date +%s)_$(openssl rand -hex 16)
ASR_API_KEY_2=asr_dev_$(date +%s)_$(openssl rand -hex 16)
ASR_API_KEY_3=asr_dev_$(date +%s)_$(openssl rand -hex 16)

# Gemini AI API Key - Add your Google AI API key here for Gemini transcription
# Get your key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-google-genai-api-key-here
EOF
        print_info "Created .secrets file with sample keys"
        print_warning "Please update the API keys in .secrets file if needed"
    else
        print_status ".secrets file exists"
    fi
    
    # Show first API key for testing
    API_KEY=$(grep "ASR_API_KEY_1" .secrets | cut -d'=' -f2)
    if [ -n "$API_KEY" ]; then
        print_info "First API key: $API_KEY"
    fi
}

# Clean up any existing containers
cleanup_containers() {
    echo ""
    echo "🧹 Cleaning up existing containers..."
    
    # Stop and remove containers if they exist
    docker compose -f docker/docker.compose.dev.yml down --remove-orphans 2>/dev/null || true
    docker compose -f docker/docker.compose.yml down --remove-orphans 2>/dev/null || true
    
    print_status "Cleanup completed"
}

# Build and start services
start_services() {
    echo ""
    echo "🐳 Building and starting development services..."
    print_info "This may take a few minutes on first run..."
    
    # Use development configuration
    docker compose -f docker/docker.compose.dev.yml up -d --build
    
    print_status "Services started"
}

# Wait for services to be ready
wait_for_services() {
    echo ""
    echo "⏳ Waiting for services to be ready..."
    
    # Wait for frontend to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:3001/api/health" > /dev/null 2>&1; then
            print_status "Frontend is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "Frontend took longer than expected to start"
            print_info "Check logs with: docker compose -f docker/docker.compose.dev.yml logs frontend"
            break
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    # Wait for whisper backend to be ready
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker compose -f docker/docker.compose.dev.yml exec whisper-backend curl -s -f "http://localhost:9000/" > /dev/null 2>&1; then
            print_status "Whisper backend is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "Whisper backend took longer than expected to start"
            print_info "Check logs with: docker compose -f docker/docker.compose.dev.yml logs whisper-backend"
            break
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
}

# Test the setup
test_setup() {
    echo ""
    echo "🧪 Testing the setup..."
    
    # Test health endpoint
    if curl -s -f "http://localhost:3001/api/health" > /dev/null; then
        print_status "Health endpoint is working"
    else
        print_warning "Health endpoint is not responding"
    fi
    
    # Test Swagger UI
    if curl -s -f "http://localhost:3001/docs" > /dev/null; then
        print_status "Swagger UI is accessible"
    else
        print_warning "Swagger UI is not accessible"
    fi
    
    # Test API with authentication (without audio file)
    if [ -n "$API_KEY" ]; then
        response=$(curl -s -w "%{http_code}" -X POST \
            -H "X-API-Key: $API_KEY" \
            "http://localhost:3001/api/v1/asr" \
            -o /dev/null)
        
        if [ "$response" = "400" ]; then
            print_status "API authentication is working (400 = missing audio file, expected)"
        else
            print_warning "API returned HTTP $response (check authentication)"
        fi
    fi
}

# Show service status
show_status() {
    echo ""
    echo "📊 Service Status:"
    echo "=================="
    docker compose -f docker/docker.compose.dev.yml ps
}

# Show usage information
show_usage() {
    echo ""
    echo "🎉 Development environment is ready!"
    echo ""
    echo "📋 Available Services:"
    echo "  • Frontend (Next.js):     http://localhost:3001"
    echo "  • Swagger UI:             http://localhost:3001/docs"
    echo "  • API Documentation:      http://localhost:3001/api/docs"
    echo "  • Health Check:           http://localhost:3001/api/health"
    echo ""
    echo "🔑 API Key for testing:"
    if [ -n "$API_KEY" ]; then
        echo "  $API_KEY"
    fi
    echo ""
    echo "🧪 Test API endpoint:"
    echo "  curl -X POST \\"
    echo "    -H 'X-API-Key: $API_KEY' \\"
    echo "    -F 'audio_file=@your-audio.mp3' \\"
    echo "    'http://localhost:3001/api/v1/asr?language=en&output=json'"
    echo ""
    echo "📝 Useful commands:"
    echo "  • View logs:              docker compose -f docker/docker.compose.dev.yml logs -f"
    echo "  • Stop services:          docker compose -f docker/docker.compose.dev.yml down"
    echo "  • Restart services:       docker compose -f docker/docker.compose.dev.yml restart"
    echo "  • Rebuild services:       docker compose -f docker/docker.compose.dev.yml up -d --build"
    echo ""
    echo "🐛 Troubleshooting:"
    echo "  • Check logs if services don't respond"
    echo "  • Ensure ports 3001 is not in use by other applications"
    echo "  • Whisper backend may take 30-60 seconds to fully initialize"
}

# Main execution
main() {
    check_prerequisites
    check_api_keys
    cleanup_containers
    start_services
    wait_for_services
    test_setup
    show_status
    show_usage
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "ASR Server Development Setup Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --clean        Clean up containers and volumes before starting"
        echo ""
        echo "This script will:"
        echo "  1. Check prerequisites (Docker, Docker Compose)"
        echo "  2. Set up API keys if needed"
        echo "  3. Build and start development services"
        echo "  4. Test the setup"
        echo "  5. Show usage information"
        exit 0
        ;;
    --clean)
        echo "🧹 Performing deep cleanup..."
        docker compose -f docker/docker.compose.dev.yml down --volumes --remove-orphans 2>/dev/null || true
        docker compose -f docker/docker.compose.yml down --volumes --remove-orphans 2>/dev/null || true
        docker system prune -f
        print_status "Deep cleanup completed"
        main
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
