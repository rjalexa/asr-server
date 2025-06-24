#!/bin/bash

# Test script to verify Docker setup for ASR server
# This script tests the Docker configuration and API endpoints

set -e

echo "🧪 Testing ASR Server Docker Setup"
echo "=================================="

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    echo "🔍 Checking $service_name on port $port..."
    
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ $service_name is running on port $port"
        return 0
    else
        echo "❌ $service_name is not responding on port $port"
        return 1
    fi
}

# Function to test API endpoint
test_api_endpoint() {
    local endpoint=$1
    local port=$2
    echo "🔍 Testing API endpoint: $endpoint"
    
    # Get API key from .secrets file
    if [ -f ".secrets" ]; then
        API_KEY=$(grep "ASR_API_KEY_1" .secrets | cut -d'=' -f2)
        if [ -z "$API_KEY" ]; then
            echo "❌ No API key found in .secrets file"
            return 1
        fi
    else
        echo "❌ .secrets file not found"
        return 1
    fi
    
    # Test with a simple curl request (without audio file)
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "X-API-Key: $API_KEY" \
        "http://localhost:$port$endpoint" \
        -o /dev/null)
    
    if [ "$response" = "400" ]; then
        echo "✅ API endpoint $endpoint is accessible (400 = missing audio file, which is expected)"
        return 0
    elif [ "$response" = "401" ]; then
        echo "❌ API endpoint $endpoint returned 401 (authentication failed)"
        return 1
    else
        echo "⚠️  API endpoint $endpoint returned HTTP $response"
        return 1
    fi
}

echo ""
echo "📋 Current Docker Configuration:"
echo "- Development: Frontend on port 3001, Whisper backend internal only"
echo "- Production: Frontend on port 9001, Whisper backend internal only"
echo "- Default: Frontend on port 3000, Whisper backend internal only"
echo ""

# Check which Docker Compose file to use
if [ "$1" = "dev" ]; then
    COMPOSE_FILE="docker.compose.dev.yml"
    FRONTEND_PORT=3001
    echo "🚀 Testing DEVELOPMENT configuration..."
elif [ "$1" = "prod" ]; then
    COMPOSE_FILE="docker.compose.prod.yml"
    FRONTEND_PORT=9001
    echo "🚀 Testing PRODUCTION configuration..."
else
    COMPOSE_FILE="docker.compose.yml"
    FRONTEND_PORT=3000
    echo "🚀 Testing DEFAULT configuration..."
fi

echo "Using: $COMPOSE_FILE"
echo ""

# Start the services
echo "🐳 Starting Docker services..."
docker compose -f $COMPOSE_FILE up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo ""
echo "🔍 Checking service status..."
docker compose -f $COMPOSE_FILE ps

echo ""
echo "🧪 Running health checks..."

# Test frontend health
if check_service "Frontend" $FRONTEND_PORT; then
    echo ""
    echo "🧪 Testing API endpoints..."
    
    # Test v1 API endpoints
    test_api_endpoint "/api/v1/asr" $FRONTEND_PORT
    test_api_endpoint "/api/v1/detect-language" $FRONTEND_PORT
    test_api_endpoint "/api/v1/transcribe-direct" $FRONTEND_PORT
    
    echo ""
    echo "🧪 Testing Swagger documentation..."
    if curl -s -f "http://localhost:$FRONTEND_PORT/docs" > /dev/null; then
        echo "✅ Swagger UI is accessible at http://localhost:$FRONTEND_PORT/docs"
    else
        echo "❌ Swagger UI is not accessible"
    fi
    
    if curl -s -f "http://localhost:$FRONTEND_PORT/api/docs" > /dev/null; then
        echo "✅ OpenAPI spec is accessible at http://localhost:$FRONTEND_PORT/api/docs"
    else
        echo "❌ OpenAPI spec is not accessible"
    fi
else
    echo "❌ Frontend service failed to start"
fi

echo ""
echo "📊 Docker logs (last 20 lines):"
echo "================================"
docker compose -f $COMPOSE_FILE logs --tail=20

echo ""
echo "🏁 Test completed!"
echo ""
echo "📝 Next steps:"
echo "1. If tests passed, try the Swagger UI at: http://localhost:$FRONTEND_PORT/docs"
echo "2. Use the 'Authorize' button to enter your API key"
echo "3. Test the endpoints with actual audio files"
echo ""
echo "🛑 To stop the services:"
echo "   docker compose -f $COMPOSE_FILE down"
