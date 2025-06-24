#!/bin/bash

# ASR Server API Setup Script
# This script helps set up the ASR server with API key protection

set -e

echo "🚀 ASR Server API Setup"
echo "======================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if running as root for nginx operations
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. This is only needed for nginx configuration."
    fi
}

# Check dependencies
check_dependencies() {
    print_header "Checking dependencies..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if port 9001 is available
    if lsof -Pi :9001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 9001 is already in use. You may need to change the ASR_EXTERNAL_PORT."
        echo "Current process using port 9001:"
        lsof -Pi :9001 -sTCP:LISTEN
        echo ""
    fi
    
    print_status "Dependencies check completed."
}

# Generate secure API keys
generate_api_keys() {
    print_header "Generating API keys..."
    
    if [[ -f .secrets ]]; then
        print_warning ".secrets file already exists. Backing up to .secrets.backup"
        cp .secrets .secrets.backup
    fi
    
    # Generate 3 secure API keys
    echo "# ASR API Keys - Generated on $(date)" > .secrets
    echo "# Keep these keys secure and do not commit to version control" >> .secrets
    echo "" >> .secrets
    
    for i in {1..3}; do
        # Generate a secure random key
        key="asr_$(date +%s)_$(openssl rand -hex 16)"
        echo "ASR_API_KEY_$i=$key" >> .secrets
        print_status "Generated API key $i: ${key:0:20}..."
    done
    
    chmod 600 .secrets
    print_status "API keys generated and saved to .secrets file."
}

# Setup environment
setup_environment() {
    print_header "Setting up environment..."
    
    if [[ ! -f .env.production ]]; then
        print_error ".env.production file not found. Please ensure you're in the correct directory."
        exit 1
    fi
    
    print_status "Environment configuration is ready."
}

# Build and start services
start_services() {
    print_header "Starting ASR services..."
    
    # Stop any existing services
    print_status "Stopping existing services..."
    docker-compose -f docker.compose.prod.yml down 2>/dev/null || true
    
    # Build and start services
    print_status "Building and starting services..."
    docker-compose -f docker.compose.prod.yml up -d --build
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 10
    
    # Check service status
    print_status "Checking service status..."
    docker-compose -f docker.compose.prod.yml ps
}

# Test the setup
test_setup() {
    print_header "Testing the setup..."
    
    # Check if services are running
    if ! docker-compose -f docker.compose.prod.yml ps | grep -q "Up"; then
        print_error "Services are not running properly."
        return 1
    fi
    
    # Test direct access to ASR service
    print_status "Testing direct ASR service access..."
    if curl -s -f http://localhost:9001/ > /dev/null; then
        print_status "✅ ASR service is accessible on port 9001"
    else
        print_warning "⚠️  ASR service may not be ready yet. This is normal on first startup."
    fi
    
    # Test Next.js frontend
    print_status "Testing Next.js frontend..."
    if curl -s -f http://localhost:3000/api/health > /dev/null; then
        print_status "✅ Next.js frontend is accessible on port 3000"
    else
        print_warning "⚠️  Next.js frontend may not be ready yet."
    fi
    
    print_status "Basic tests completed."
}

# Setup nginx (optional)
setup_nginx() {
    print_header "Nginx setup (optional)..."
    
    if [[ $EUID -ne 0 ]]; then
        print_warning "Nginx setup requires root privileges. Skipping nginx configuration."
        print_status "To set up nginx manually:"
        echo "  1. sudo cp nginx/asr-nginx.conf /etc/nginx/sites-available/asr-server"
        echo "  2. Edit the configuration file to update domain and API keys"
        echo "  3. sudo ln -s /etc/nginx/sites-available/asr-server /etc/nginx/sites-enabled/"
        echo "  4. sudo nginx -t && sudo systemctl reload nginx"
        return 0
    fi
    
    if ! command -v nginx &> /dev/null; then
        print_warning "Nginx is not installed. Skipping nginx configuration."
        return 0
    fi
    
    read -p "Do you want to set up nginx configuration? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Skipping nginx setup."
        return 0
    fi
    
    # Copy nginx configuration
    cp nginx/asr-nginx.conf /etc/nginx/sites-available/asr-server
    
    print_warning "Please edit /etc/nginx/sites-available/asr-server to:"
    echo "  1. Replace 'your-domain.com' with your actual domain"
    echo "  2. Update API keys in the map section"
    echo "  3. Configure SSL certificates if using HTTPS"
    
    read -p "Press Enter after editing the nginx configuration..."
    
    # Test nginx configuration
    if nginx -t; then
        # Enable site
        ln -sf /etc/nginx/sites-available/asr-server /etc/nginx/sites-enabled/
        systemctl reload nginx
        print_status "✅ Nginx configuration applied successfully."
    else
        print_error "Nginx configuration test failed. Please check the configuration."
    fi
}

# Display summary
show_summary() {
    print_header "Setup Summary"
    echo "=============="
    echo ""
    
    print_status "Services Status:"
    docker-compose -f docker.compose.prod.yml ps
    echo ""
    
    print_status "API Access Points:"
    echo "  • Next.js Frontend: http://localhost:3000"
    echo "  • Direct ASR API: http://localhost:9001"
    echo "  • Next.js API Endpoint: http://localhost:3000/api/transcribe-direct"
    echo ""
    
    print_status "API Keys (first 20 chars):"
    if [[ -f .secrets ]]; then
        grep "ASR_API_KEY" .secrets | while read -r line; do
            key=$(echo "$line" | cut -d'=' -f2)
            echo "  • ${key:0:20}..."
        done
    fi
    echo ""
    
    print_status "Next Steps:"
    echo "  1. Test the API using the examples in ASR_API_SETUP.md"
    echo "  2. Configure nginx for production (if not done already)"
    echo "  3. Set up SSL certificates for HTTPS"
    echo "  4. Monitor logs: docker-compose -f docker.compose.prod.yml logs -f"
    echo ""
    
    print_status "Documentation:"
    echo "  • Complete setup guide: ASR_API_SETUP.md"
    echo "  • API usage examples included in the documentation"
    echo ""
}

# Main execution
main() {
    print_header "ASR Server API Setup Script"
    echo ""
    
    check_root
    check_dependencies
    
    # Ask user what they want to do
    echo "What would you like to do?"
    echo "1) Full setup (generate keys, start services, test)"
    echo "2) Generate new API keys only"
    echo "3) Start/restart services only"
    echo "4) Test current setup"
    echo "5) Setup nginx configuration"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            generate_api_keys
            setup_environment
            start_services
            test_setup
            setup_nginx
            show_summary
            ;;
        2)
            generate_api_keys
            print_status "New API keys generated. Restart services to apply changes."
            ;;
        3)
            start_services
            test_setup
            ;;
        4)
            test_setup
            ;;
        5)
            setup_nginx
            ;;
        *)
            print_error "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    print_status "Setup completed! 🎉"
}

# Run main function
main "$@"
