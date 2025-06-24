# ASR Server API Setup and Usage Guide

This guide explains how to set up and use the ASR (Automatic Speech Recognition) server with direct API access, API key protection, and nginx configuration.

## Overview

The ASR server provides two ways to access speech recognition:
1. **Web Interface**: User-friendly frontend at `http://your-domain.com`
2. **Direct API Access**: Programmatic access with API key authentication

## Architecture

```
Client Request → Next.js Frontend (Port 3000) → Protected API Endpoints → ASR Service (Internal Network)
              ↓
              API Key Authentication & Rate Limiting
```

**Security Model:**
- ASR backend is only accessible via internal Docker network
- All external access goes through protected API endpoints
- API key authentication and rate limiting on all endpoints
- No direct host access to ASR service

## Setup Instructions

### 1. Configure API Keys

Create and configure your API keys in the `.secrets` file:

```bash
# .secrets file (already created, modify as needed)
ASR_API_KEY_1=asr_prod_abc123def456ghi789
ASR_API_KEY_2=asr_dev_xyz789uvw012rst345
ASR_API_KEY_3=asr_test_mno456pqr789stu012
```

**Important**: 
- The `.secrets` file is gitignored for security
- Use strong, unique API keys in production
- Each line should follow the format: `KEY_NAME=key_value`

### 2. Environment Configuration

The following environment variables are configured in `.env.production`:

```bash
# ASR Direct Access Configuration
ASR_EXTERNAL_PORT=9001                    # Port where ASR service is exposed
ASR_RATE_LIMIT_PER_MINUTE=30             # API calls per minute per key
ASR_RATE_LIMIT_BURST=5                   # Burst allowance
ASR_SECRETS_FILE=.secrets                # Path to secrets file
```

### 3. Docker Deployment

Deploy using the production Docker Compose configuration:

```bash
# Start the services
docker compose -f docker.compose.prod.yml up -d

# Check service status
docker compose -f docker.compose.prod.yml ps

# View logs
docker compose -f docker.compose.prod.yml logs -f
```

The ASR service will be available on:
- **Internal**: `http://whisper-backend:9000` (container-to-container only)
- **External**: Access via protected API endpoints only (no direct host access)

### 4. Nginx Configuration

#### Option A: Direct Nginx Setup

1. Copy the nginx configuration:
```bash
sudo cp nginx/asr-nginx.conf /etc/nginx/sites-available/asr-server
```

2. Update the configuration:
```bash
sudo nano /etc/nginx/sites-available/asr-server
```

3. Replace placeholders:
   - `your-domain.com` → your actual domain
   - Update API keys in the `map $http_x_api_key $api_key_valid` section
   - Configure SSL certificates if using HTTPS

4. Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/asr-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Include in Existing Nginx Config

Add the following to your existing nginx configuration:

```nginx
# Add to your existing server block
location /asr/ {
    # API key validation
    if ($http_x_api_key = "") {
        return 401 '{"error": "Missing X-API-Key header"}';
    }
    
    # Add your API key validation here
    if ($http_x_api_key !~ ^(asr_prod_abc123def456ghi789|asr_dev_xyz789uvw012rst345)$) {
        return 401 '{"error": "Invalid API key"}';
    }
    
    # Rate limiting
    limit_req zone=asr_api burst=5 nodelay;
    
    # Proxy to ASR service
    proxy_pass http://localhost:9001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 300s;
    client_max_body_size 50M;
}
```

## API Usage

### Protected API Endpoints (v1)

All API endpoints require authentication with X-API-Key header. The following versioned endpoints are available:

#### 1. ASR (Automatic Speech Recognition) - v1
```bash
# Basic transcription
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio_file=@recording.mp3" \
  "https://your-domain.com/api/v1/asr?language=en&output=json"

# With specific parameters
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio_file=@recording.wav" \
  "https://your-domain.com/api/v1/asr?language=it&model=base&task=transcribe&output=json"
```

#### 2. Language Detection - v1
```bash
# Detect language from audio
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio_file=@recording.mp3" \
  "https://your-domain.com/api/v1/detect-language"
```

#### 3. Enhanced Transcription - v1
```bash
# Using the enhanced API endpoint with additional features
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio=@recording.mp3" \
  "https://your-domain.com/api/v1/transcribe-direct?language=en&model=base"
```

#### 4. Interactive API Documentation
```bash
# Access Swagger UI documentation
https://your-domain.com/docs

# Get OpenAPI specification
curl https://your-domain.com/api/docs
```

### Legacy Endpoints (Deprecated)

The following endpoints are deprecated and will be removed in future versions. Please migrate to v1 endpoints:

- `/api/asr` → `/api/v1/asr`
- `/api/detect-language` → `/api/v1/detect-language`
- `/api/transcribe-direct` → `/api/v1/transcribe-direct`

### Security Model

✅ **Enhanced Security**: The ASR backend is now only accessible via the internal Docker network. All external access must go through the protected API endpoints with proper authentication.

**Benefits:**
- No direct host access to ASR service
- All requests require API key authentication
- Rate limiting applied to all endpoints
- Comprehensive request validation

### Response Format

#### Direct ASR Service Response
```json
{
  "text": "Hello, this is a test transcription.",
  "language": "en",
  "confidence": 0.95
}
```

#### Next.js API Response
```json
{
  "success": true,
  "data": {
    "transcript": "Hello, this is a test transcription.",
    "language": "en",
    "model": "base",
    "confidence": 0.95,
    "metadata": {
      "filename": "recording.mp3",
      "size": 1048576,
      "processedAt": "2025-01-24T14:30:00.000Z"
    }
  },
  "rateLimit": {
    "remaining": 29,
    "resetTime": "2025-01-24T14:31:00.000Z"
  }
}
```

## API Parameters

### Query Parameters

| Parameter | Description | Default | Options |
|-----------|-------------|---------|---------|
| `language` | Audio language | `en` | `en`, `it`, `fr`, `es`, `de` |
| `model` | Whisper model | `base` | `tiny`, `base`, `small`, `medium`, `large` |
| `output` | Response format | `json` | `json`, `text` |
| `task` | Processing task | `transcribe` | `transcribe`, `translate` |

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | Valid API key from `.secrets` file |
| `Content-Type` | Auto | Set automatically for multipart uploads |

## Rate Limiting

- **Limit**: 30 requests per minute per API key
- **Burst**: 5 additional requests allowed
- **Window**: 60 seconds rolling window
- **Headers**: Rate limit info included in responses

Rate limit headers in responses:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 2025-01-24T14:31:00.000Z
```

## Error Handling

### Common Error Responses

#### Missing API Key (401)
```json
{
  "error": "Missing API key",
  "message": "Please provide X-API-Key header"
}
```

#### Invalid API Key (401)
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is not valid"
}
```

#### Rate Limit Exceeded (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Rate limit: 30 requests per minute",
  "resetTime": "2025-01-24T14:31:00.000Z"
}
```

#### File Too Large (413)
```json
{
  "error": "File too large",
  "message": "Maximum file size is 50MB"
}
```

## Security Features

### API Key Protection
- Keys stored in gitignored `.secrets` file
- Server-side validation for all requests
- No keys exposed in logs or environment variables

### Rate Limiting
- Per-API-key rate limiting (30 req/min)
- Burst protection (5 additional requests)
- Automatic cleanup of expired rate limit data

### Request Validation
- File type validation (audio files only)
- File size limits (50MB maximum)
- Request method validation (POST only)

### Security Headers
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Monitoring and Logging

### Health Check
```bash
curl https://your-domain.com/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-24T14:30:00.000Z"
}
```

### Log Monitoring
```bash
# Docker logs
docker compose -f docker.compose.prod.yml logs -f whisper-backend
docker compose -f docker.compose.prod.yml logs -f frontend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues

#### 1. Port 9001 Already in Use
```bash
# Check what's using the port
sudo lsof -i :9001

# Change port in docker.compose.prod.yml and nginx config
```

#### 2. API Keys Not Working
```bash
# Verify .secrets file format
cat .secrets

# Check file permissions
ls -la .secrets

# Restart services after key changes
docker compose -f docker.compose.prod.yml restart
```

#### 3. Rate Limiting Too Strict
```bash
# Update environment variable
echo "ASR_RATE_LIMIT_PER_MINUTE=60" >> .env.production

# Restart services
docker compose -f docker.compose.prod.yml restart
```

#### 4. Large File Upload Issues
```bash
# Check nginx client_max_body_size
sudo nginx -T | grep client_max_body_size

# Increase timeout values in nginx config
proxy_read_timeout 600s;
client_body_timeout 120s;
```

### Testing the Setup

#### 1. Test Protected API Endpoints (v1)
```bash
# Test ASR endpoint v1
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio_file=@test.mp3" \
  "https://your-domain.com/api/v1/asr?language=en&output=json"

# Test language detection endpoint v1
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio_file=@test.mp3" \
  "https://your-domain.com/api/v1/detect-language"

# Test enhanced transcription endpoint v1
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio=@test.mp3" \
  "https://your-domain.com/api/v1/transcribe-direct?language=en"

# Test Swagger documentation
curl https://your-domain.com/docs
curl https://your-domain.com/api/docs
```

## Production Recommendations

### Security
1. Use HTTPS in production (configure SSL certificates)
2. Implement IP whitelisting if needed
3. Regularly rotate API keys
4. Monitor access logs for suspicious activity
5. Use strong, unique API keys (minimum 32 characters)

### Performance
1. Enable nginx caching for static assets
2. Use HTTP/2 for better performance
3. Monitor resource usage and scale as needed
4. Consider using a CDN for global distribution

### Monitoring
1. Set up log aggregation (ELK stack, etc.)
2. Monitor rate limit violations
3. Track API usage per key
4. Set up alerts for service downtime
5. Monitor disk space for audio processing

### Backup
1. Backup `.secrets` file securely
2. Document API key distribution
3. Have a key rotation procedure
4. Backup nginx configuration

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker and nginx logs
3. Verify API key configuration
4. Test with curl commands provided

## API Integration Examples

### Python
```python
import requests

def transcribe_audio(file_path, api_key, language='en', endpoint='transcribe-direct'):
    """
    Transcribe audio using different endpoints
    endpoint options: 'transcribe-direct', 'asr'
    """
    if endpoint == 'asr':
        url = 'https://your-domain.com/api/asr'
        files = {'audio_file': open(file_path, 'rb')}
        params = {'language': language, 'output': 'json'}
    else:
        url = 'https://your-domain.com/api/transcribe-direct'
        files = {'audio': open(file_path, 'rb')}
        params = {'language': language, 'model': 'base'}
    
    headers = {'X-API-Key': api_key}
    response = requests.post(url, headers=headers, files=files, params=params)
    return response.json()

def detect_language(file_path, api_key):
    """Detect language from audio file"""
    url = 'https://your-domain.com/api/detect-language'
    headers = {'X-API-Key': api_key}
    files = {'audio_file': open(file_path, 'rb')}
    
    response = requests.post(url, headers=headers, files=files)
    return response.json()

# Usage examples
api_key = 'asr_prod_abc123def456ghi789'

# Enhanced transcription
result = transcribe_audio('recording.mp3', api_key)
print(result['data']['transcript'])

# Direct ASR
result = transcribe_audio('recording.mp3', api_key, endpoint='asr')
print(result['text'])

# Language detection
lang_result = detect_language('recording.mp3', api_key)
print(f"Detected language: {lang_result['detected_language']}")
```

### JavaScript/Node.js
```javascript
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

async function transcribeAudio(filePath, apiKey, language = 'en') {
    const form = new FormData();
    form.append('audio', fs.createReadStream(filePath));
    
    const response = await fetch('https://your-domain.com/api/transcribe-direct?language=' + language, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            ...form.getHeaders()
        },
        body: form
    });
    
    return await response.json();
}

// Usage
transcribeAudio('recording.mp3', 'asr_prod_abc123def456ghi789')
    .then(result => console.log(result.data.transcript));
```

### cURL Examples
```bash
# Basic transcription
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio=@recording.mp3" \
  "https://your-domain.com/api/transcribe-direct"

# Italian transcription with medium model
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio=@italian_recording.wav" \
  "https://your-domain.com/api/transcribe-direct?language=it&model=medium"

# Direct ASR service access
curl -X POST \
  -H "X-API-Key: asr_prod_abc123def456ghi789" \
  -F "audio_file=@recording.mp3" \
  "https://your-domain.com/asr/asr?language=en&output=json"
