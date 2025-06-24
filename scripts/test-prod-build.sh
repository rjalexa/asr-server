#!/bin/bash

# Test production build script
set -e

echo "🔨 Building production Docker image..."
cd docker
docker-compose -f docker.compose.yml -f docker.compose.prod.yml build asr-server

echo "🚀 Starting production container..."
docker-compose -f docker.compose.yml -f docker.compose.prod.yml up -d asr-server

echo "⏳ Waiting for server to be ready..."
sleep 5

echo "🔍 Testing /docs endpoint..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/docs

echo ""
echo "✅ Production build complete!"
echo "📝 Visit http://localhost:3000/docs to check the documentation page"
echo ""
echo "To stop the container, run:"
echo "cd docker && docker-compose -f docker.compose.yml -f docker.compose.prod.yml down"
