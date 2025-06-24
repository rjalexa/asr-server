# ASR Server Docker Configuration - FIXED

## Issue Resolution

The ASR v1 API was returning 404 errors because of a mismatch between the expected Whisper service configuration and the actual Docker setup. This has been **FIXED**.

### What Was Wrong

1. **Port Mismatch**: The API was trying to call `http://localhost:9001/asr` but the Whisper backend runs on port 9000 inside Docker
2. **Network Configuration**: The services needed to communicate via Docker internal network, not localhost
3. **Environment Variables**: Inconsistent WHISPER_API_URL values across different environments

### What Was Fixed

✅ **Docker Compose Files Updated**:
- `docker.compose.yml` - Default setup (Frontend: 3000, Backend: internal network only)
- `docker.compose.dev.yml` - Development setup (Frontend: 3001, Backend: internal network only)  
- `docker.compose.prod.yml` - Production setup (Frontend: 9001, Backend: internal network only)

✅ **Environment Variables Standardized**:
- All environments now use `WHISPER_API_URL=http://whisper-backend:9000`
- Consistent model and language defaults across all environments

✅ **API Endpoints Fixed**:
- All v1 API endpoints now correctly use the Docker internal network
- Proper error handling and logging added

## Current Architecture

```
External Request → Frontend Container (Port 3000/3001/9001) → Whisper Backend (Internal Network Only)
                                                            ↓
                                                    whisper-backend:9000
```

### Security Model
- ✅ Whisper backend is **NOT** exposed to host - only accessible via internal Docker network
- ✅ All external access goes through protected API endpoints with API key authentication
- ✅ Rate limiting and request validation on all endpoints

## Quick Start

### 1. Test the Default Configuration
```bash
# Start with default settings (Frontend on port 3000)
./test-docker-setup.sh

# Or manually:
docker compose up -d
```

### 2. Test Development Configuration  
```bash
# Start development environment (Frontend on port 3001)
./test-docker-setup.sh dev

# Or manually:
docker compose -f docker.compose.dev.yml up -d
```

### 3. Test Production Configuration
```bash
# Start production environment (Frontend on port 9001)
./test-docker-setup.sh prod

# Or manually:
docker compose -f docker.compose.prod.yml up -d
```

## Port Configuration

| Environment | Frontend Port | Whisper Backend | Access URL |
|-------------|---------------|-----------------|------------|
| Default     | 3000          | Internal only   | http://localhost:3000 |
| Development | 3001          | Internal only   | http://localhost:3001 |
| Production  | 9001          | Internal only   | http://localhost:9001 |

## Testing the Fix

### 1. Run the Test Script
```bash
# Test default configuration
./test-docker-setup.sh

# Test development configuration  
./test-docker-setup.sh dev

# Test production configuration
./test-docker-setup.sh prod
```

### 2. Manual Testing
```bash
# Get your API key
API_KEY=$(grep "ASR_API_KEY_1" .secrets | cut -d'=' -f2)

# Test the ASR v1 endpoint (replace 3000 with your port)
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -F "audio_file=@your-audio-file.mp3" \
  "http://localhost:3000/api/v1/asr?language=de&model=base&task=transcribe&output=json"
```

### 3. Swagger UI Testing
1. Open your browser to the appropriate URL:
   - Default: http://localhost:3000/docs
   - Development: http://localhost:3001/docs  
   - Production: http://localhost:9001/docs

2. Click "Authorize" and enter your API key from `.secrets`

3. Test the `/api/v1/asr` endpoint with an audio file

## Environment Files

### .env.development
```bash
WHISPER_API_URL=http://whisper-backend:9000
WHISPER_MODEL=base
WHISPER_DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,it,fr,es,de
```

### .env.production  
```bash
WHISPER_API_URL=http://whisper-backend:9000
WHISPER_MODEL=base
WHISPER_DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,it,fr,es,de
```

## Docker Compose Configurations

### Default (docker.compose.yml)
- **Frontend**: Port 3000, with volume mounts for development
- **Backend**: Internal network only, no host ports exposed
- **Use case**: Local development and testing

### Development (docker.compose.dev.yml)
- **Frontend**: Port 3001, with volume mounts for hot reload
- **Backend**: Internal network only, no host ports exposed  
- **Use case**: Development environment with different port to avoid conflicts

### Production (docker.compose.prod.yml)
- **Frontend**: Port 9001, optimized for production
- **Backend**: Internal network only, no host ports exposed
- **Use case**: Production deployment with resource limits

## API Endpoints (All Fixed)

### v1 API Endpoints (Recommended)
- `POST /api/v1/asr` - Automatic Speech Recognition
- `POST /api/v1/detect-language` - Language Detection  
- `POST /api/v1/transcribe-direct` - Enhanced Transcription

### Documentation
- `GET /docs` - Interactive Swagger UI
- `GET /api/docs` - OpenAPI specification

## Troubleshooting

### If You Still Get 404 Errors

1. **Check Docker Services**:
   ```bash
   docker compose ps
   docker compose logs whisper-backend
   ```

2. **Verify Environment Variables**:
   ```bash
   docker compose exec frontend env | grep WHISPER
   ```

3. **Test Internal Network**:
   ```bash
   docker compose exec frontend curl http://whisper-backend:9000/
   ```

### Common Issues

#### "Connection Refused" Errors
- **Cause**: Whisper backend not fully started
- **Solution**: Wait 30-60 seconds after `docker compose up` for models to load

#### "Invalid API Key" Errors  
- **Cause**: Missing or incorrect API key in `.secrets`
- **Solution**: Check `.secrets` file format and ensure API key is correct

#### Port Already in Use
- **Cause**: Another service using the same port
- **Solution**: Use different Docker compose file or stop conflicting service

## Next Steps

1. **✅ FIXED**: The 404 error when calling ASR v1 API endpoints
2. **✅ VERIFIED**: Docker internal networking between frontend and backend
3. **✅ TESTED**: All three environment configurations work correctly

### For Production Deployment

1. Update domain names in nginx configuration
2. Set up SSL certificates for HTTPS
3. Configure proper logging and monitoring
4. Set up backup procedures for API keys and data

### For Development

1. Use the test script to verify setup: `./test-docker-setup.sh dev`
2. Access Swagger UI at http://localhost:3001/docs
3. Test with real audio files through the interactive interface

## Summary

The ASR server Docker configuration has been completely fixed:

- ✅ **Network Communication**: Frontend properly communicates with Whisper backend via Docker internal network
- ✅ **Port Configuration**: Clear separation between dev (3001), default (3000), and prod (9001) ports  
- ✅ **Security**: Whisper backend only accessible internally, all external access through protected APIs
- ✅ **Environment Consistency**: All environment files use correct WHISPER_API_URL values
- ✅ **Testing**: Comprehensive test script to verify all configurations work

The original curl command should now work correctly:

```bash
curl -X 'POST' \
  'http://localhost:3000/api/v1/asr?language=de&model=base&task=transcribe&output=json' \
  -H 'accept: application/json' \
  -H 'X-API-Key: asr_1750768071_583b1ae5509f24da33e64003502bedf6' \
  -H 'Content-Type: multipart/form-data' \
  -F 'audio_file=@health-german.mp3;type=audio/mpeg'
```

(Replace `localhost:3000` with the appropriate port for your environment)
