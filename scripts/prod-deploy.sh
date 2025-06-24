#!/bin/bash

# ASR Server - Production Deployment Script
# This script deploys the ASR server for production use

set -e

echo "🚀 ASR Server - Production Deployment"
echo "====================================="

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
        echo "  Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io docker-compose-plugin"
        echo "  CentOS/RHEL: sudo yum install docker docker-compose"
        echo "  macOS: brew install --cask docker"
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
        echo "  sudo systemctl start docker"
        exit 1
    fi
    print_status "Docker is running"
    
    # Check if running as root or in docker group
    if [ "$EUID" -ne 0 ] && ! groups | grep -q docker; then
        print_warning "You may need to run with sudo or add your user to the docker group:"
        echo "  sudo usermod -aG docker \$USER"
        echo "  Then log out and back in"
    fi
}

# Validate production environment
validate_environment() {
    echo ""
    echo "🔍 Validating production environment..."
    
    # Check if .secrets file exists
    if [ ! -f ".secrets" ]; then
        print_error ".secrets file is required for production deployment"
        echo ""
        echo "Please create a .secrets file with your API keys:"
        echo "  ASR_API_KEY_1=your_production_key_1"
        echo "  ASR_API_KEY_2=your_production_key_2"
        echo "  ASR_API_KEY_3=your_production_key_3"
        exit 1
    fi
    print_status ".secrets file exists"
    
    # Check if API keys look production-ready
    if grep -q "dev_" .secrets; then
        print_warning "Found development API keys in .secrets file"
        print_info "Consider using production-specific API keys"
    fi
    
    # Check available disk space (need at least 5GB for models)
    available_space=$(df . | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 5242880 ]; then  # 5GB in KB
        print_warning "Less than 5GB disk space available. Whisper models require significant storage."
    fi
    
    # Check available memory (recommend at least 4GB)
    if [ -f /proc/meminfo ]; then
        available_memory=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        if [ "$available_memory" -lt 4194304 ]; then  # 4GB in KB
            print_warning "Less than 4GB memory available. Consider upgrading for better performance."
        fi
    fi
}

# Setup production configuration
setup_production_config() {
    echo ""
    echo "⚙️  Setting up production configuration..."
    
    # Create production environment file if it doesn't exist
    if [ ! -f "config/.env.production" ]; then
        print_info "Creating config/.env.production file..."
        cat > config/.env.production << 'EOF'
# Whisper Configuration
WHISPER_API_URL=http://whisper-backend:9000
WHISPER_MODEL=base
WHISPER_DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,it,fr,es,de

# ASR Direct Access Configuration
ASR_EXTERNAL_PORT=9001
ASR_RATE_LIMIT_PER_MINUTE=30
ASR_RATE_LIMIT_BURST=5
ASR_SECRETS_FILE=.secrets

# Next.js Configuration
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=http://localhost:9001
EOF
        print_status "Created config/.env.production file"
    else
        print_status "config/.env.production file exists"
    fi
}

# Clean up existing deployment
cleanup_deployment() {
    echo ""
    echo "🧹 Cleaning up existing deployment..."
    
    # Stop and remove existing containers using docker compose
    print_info "Stopping services with docker compose..."
    docker compose -f docker/docker.compose.prod.yml down --remove-orphans 2>/dev/null || true
    
    # Force remove specific containers if they still exist
    print_info "Checking for stuck containers..."
    
    # List of containers that might be stuck
    containers_to_remove=("whisper-backend" "asr-frontend")
    
    for container in "${containers_to_remove[@]}"; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            print_info "Removing stuck container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm -f "$container" 2>/dev/null || true
        fi
    done
    
    # Remove any containers with the same image that might be conflicting
    print_info "Removing any conflicting containers..."
    docker ps -a --filter "ancestor=onerahmet/openai-whisper-asr-webservice:latest" --format '{{.ID}}' | xargs -r docker rm -f 2>/dev/null || true
    
    # Remove unused images and containers (but keep volumes)
    docker system prune -f
    
    print_status "Cleanup completed"
}

# Build and deploy services
deploy_services() {
    echo ""
    echo "🐳 Building and deploying production services..."
    print_info "This may take several minutes on first deployment..."
    
    # Build and start production services
    docker compose -f docker/docker.compose.prod.yml up -d --build
    
    print_status "Services deployed"
}

# Wait for services to be ready
wait_for_services() {
    echo ""
    echo "⏳ Waiting for services to be ready..."
    
    local max_attempts=60  # Longer timeout for production
    local attempt=1
    
    # Wait for frontend to be ready
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:9001/api/health" > /dev/null 2>&1; then
            print_status "Frontend is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "Frontend took longer than expected to start"
            print_info "Check logs with: docker compose -f docker/docker.compose.prod.yml logs frontend"
            break
        fi
        
        if [ $((attempt % 10)) -eq 0 ]; then
            echo " (${attempt}s)"
        else
            echo -n "."
        fi
        sleep 1
        ((attempt++))
    done
    
    # Wait for whisper backend to be ready (this can take a while)
    echo ""
    print_info "Waiting for Whisper backend to initialize (this may take 1-2 minutes)..."
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker compose -f docker/docker.compose.prod.yml exec -T whisper-backend curl -s -f "http://localhost:9000/" > /dev/null 2>&1; then
            print_status "Whisper backend is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "Whisper backend took longer than expected to start"
            print_info "Check logs with: docker compose -f docker/docker.compose.prod.yml logs whisper-backend"
            break
        fi
        
        if [ $((attempt % 10)) -eq 0 ]; then
            echo " (${attempt}s)"
        else
            echo -n "."
        fi
        sleep 1
        ((attempt++))
    done
}

# Test the deployment
test_deployment() {
    echo ""
    echo "🧪 Testing the deployment..."
    
    # Get API key for testing
    API_KEY=$(grep "ASR_API_KEY_1" .secrets | cut -d'=' -f2 2>/dev/null || echo "")
    
    # Test health endpoint
    if curl -s -f "http://localhost:9001/api/health" > /dev/null; then
        print_status "Health endpoint is working"
    else
        print_warning "Health endpoint is not responding"
    fi
    
    # Test Swagger UI
    if curl -s -f "http://localhost:9001/docs" > /dev/null; then
        print_status "Swagger UI is accessible"
    else
        print_warning "Swagger UI is not accessible"
    fi
    
    # Test API authentication
    if [ -n "$API_KEY" ]; then
        response=$(curl -s -w "%{http_code}" -X POST \
            -H "X-API-Key: $API_KEY" \
            "http://localhost:9001/api/v1/asr" \
            -o /dev/null 2>/dev/null)
        
        if [ "$response" = "400" ]; then
            print_status "API authentication is working"
        else
            print_warning "API returned HTTP $response"
        fi
    else
        print_warning "No API key found for testing"
    fi
}

# Show deployment status
show_status() {
    echo ""
    echo "📊 Deployment Status:"
    echo "===================="
    docker compose -f docker/docker.compose.prod.yml ps
    
    echo ""
    echo "💾 Resource Usage:"
    echo "=================="
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
}

# Setup monitoring and logging
setup_monitoring() {
    echo ""
    echo "📊 Setting up monitoring..."
    
    # Create log rotation configuration
    if [ ! -f "/etc/logrotate.d/docker-asr" ]; then
        print_info "Setting up log rotation..."
        cat > /tmp/docker-asr-logrotate << 'EOF'
/var/lib/docker/containers/*/*-json.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    postrotate
        docker kill --signal=USR1 $(docker ps -q) 2>/dev/null || true
    endscript
}
EOF
        if [ "$EUID" -eq 0 ]; then
            mv /tmp/docker-asr-logrotate /etc/logrotate.d/docker-asr
            print_status "Log rotation configured"
        else
            print_info "Run as root to configure log rotation:"
            print_info "sudo mv /tmp/docker-asr-logrotate /etc/logrotate.d/docker-asr"
        fi
    fi
}

# Show production usage information
show_production_usage() {
    echo ""
    echo "🎉 Production deployment completed!"
    echo ""
    echo "📋 Production Services:"
    echo "  • Frontend (Next.js):     http://localhost:9001"
    echo "  • Swagger UI:             http://localhost:9001/docs"
    echo "  • API Documentation:      http://localhost:9001/api/docs"
    echo "  • Health Check:           http://localhost:9001/api/health"
    echo ""
    echo "🔑 API Key for testing:"
    if [ -n "$API_KEY" ]; then
        echo "  $API_KEY"
    else
        echo "  Check .secrets file for your API keys"
    fi
    echo ""
    echo "🧪 Test API endpoint:"
    echo "  curl -X POST \\"
    echo "    -H 'X-API-Key: YOUR_API_KEY' \\"
    echo "    -F 'audio_file=@your-audio.mp3' \\"
    echo "    'http://localhost:9001/api/v1/asr?language=en&output=json'"
    echo ""
    echo "📝 Production Management:"
    echo "  • View logs:              docker compose -f docker/docker.compose.prod.yml logs -f"
    echo "  • Stop services:          docker compose -f docker/docker.compose.prod.yml down"
    echo "  • Restart services:       docker compose -f docker/docker.compose.prod.yml restart"
    echo "  • Update deployment:      docker compose -f docker/docker.compose.prod.yml up -d --build"
    echo "  • Monitor resources:      docker stats"
    echo ""
    echo "🔒 Security Recommendations:"
    echo "  • Use a reverse proxy (nginx) for SSL termination"
    echo "  • Configure firewall to restrict access to port 9001"
    echo "  • Regularly rotate API keys"
    echo "  • Monitor logs for suspicious activity"
    echo "  • Keep Docker images updated"
    echo ""
    echo "🚨 Important Notes:"
    echo "  • Whisper backend is only accessible internally (secure)"
    echo "  • All external access requires API key authentication"
    echo "  • Rate limiting is enabled (30 requests/minute per key)"
    echo "  • Logs are automatically rotated (if configured as root)"
}

# Main execution
main() {
    check_prerequisites
    validate_environment
    setup_production_config
    cleanup_deployment
    deploy_services
    wait_for_services
    test_deployment
    show_status
    setup_monitoring
    show_production_usage
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "ASR Server Production Deployment Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --clean        Perform deep cleanup before deployment"
        echo "  --update       Update existing deployment"
        echo ""
        echo "This script will:"
        echo "  1. Check prerequisites and validate environment"
        echo "  2. Set up production configuration"
        echo "  3. Build and deploy production services"
        echo "  4. Test the deployment"
        echo "  5. Set up monitoring and logging"
        echo "  6. Show production usage information"
        echo ""
        echo "Prerequisites:"
        echo "  • Docker and Docker Compose installed"
        echo "  • .secrets file with production API keys"
        echo "  • At least 5GB disk space and 4GB RAM"
        exit 0
        ;;
    --clean)
        echo "🧹 Performing deep cleanup..."
        
        # Stop all containers using this compose file
        docker compose -f docker/docker.compose.prod.yml down --volumes --remove-orphans 2>/dev/null || true
        
        # Force remove specific containers
        containers_to_remove=("whisper-backend" "asr-frontend")
        for container in "${containers_to_remove[@]}"; do
            if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
                print_info "Force removing container: $container"
                docker stop "$container" 2>/dev/null || true
                docker rm -f "$container" 2>/dev/null || true
            fi
        done
        
        # Remove any containers with the same image that might be conflicting
        print_info "Removing any conflicting containers..."
        docker ps -a --filter "ancestor=onerahmet/openai-whisper-asr-webservice:latest" --format '{{.ID}}' | xargs -r docker rm -f 2>/dev/null || true
        
        # Deep system cleanup
        docker system prune -af
        print_status "Deep cleanup completed"
        main
        ;;
    --update)
        echo "� Updating existing deployment..."
        docker compose -f docker/docker.compose.prod.yml pull
        docker compose -f docker/docker.compose.prod.yml up -d --build
        print_status "Deployment updated"
        show_status
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
