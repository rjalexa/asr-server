# MP3 Recording & Transcription Demo (Docker Edition)

A Next.js application for MP3 audio recording and transcription using Docker-based OpenAI Whisper ASR webservice.

## Features

- 🎤 High-quality MP3 audio recording from browser
- 🤖 Automatic transcription with configurable Whisper models
- 🌍 Multi-language support (English, Italian, French, Spanish, German)
- 💾 Download audio files (MP3 format)
- 📄 Download transcribed text as .txt files
- 🎧 Audio preview with playback controls
- 🐳 Fully containerized with Docker Compose
- 🎯 Clean, modern UI with model and language selection
- ⚡ No local dependencies required

## Architecture

```
┌─────────────────┐    HTTP     ┌──────────────────────┐    HTTP API    ┌─────────────────────────┐
│     Browser     │ ──────────► │   Next.js Frontend   │ ─────────────► │  Whisper ASR Backend   │
│                 │             │    (Port 3000)       │                │     (Port 9000)         │
└─────────────────┘             └──────────────────────┘                └─────────────────────────┘
                                          │                                          │
                                          │                                          │
                                    ┌──────────────┐                        ┌──────────────┐
                                    │   Docker     │                        │   Docker     │
                                    │  Container   │                        │  Container   │
                                    └──────────────┘                        └──────────────┘
```

## Prerequisites

- **Docker** (20.10+)
- **Docker Compose** (2.0+)

That's it! No Node.js, Python, or other dependencies needed on your host machine.

## Quick Start

### Development Environment

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd asr-server
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env.development
   # Edit .env.development if needed (defaults should work)
   ```

3. **Start development environment:**
   ```bash
   docker compose -f docker.compose.yml -f docker.compose.dev.yml up
   ```

4. **Access the application:**
   ```
   http://localhost:3000
   ```

The development environment includes:
- Hot reload for code changes
- Volume mounting for instant updates
- Debug logging
- Direct port access

### Production Environment

1. **Set up production environment:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your settings
   ```

2. **Build and start production:**
   ```bash
   docker compose -f docker.compose.yml -f docker.compose.prod.yml up -d
   ```

3. **Configure your existing nginx:**
   Add this location block to your nginx configuration:
   ```nginx
   location /whisper-demo {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
   }
   ```

4. **Reload nginx:**
   ```bash
   sudo nginx -t && sudo nginx -s reload
   ```

## Configuration

### Environment Variables

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `WHISPER_API_URL` | Whisper service URL | `http://whisper-backend:9000` | Internal Docker URL |
| `WHISPER_MODEL` | Default model size | `base` | `tiny`, `base`, `small`, `medium`, `large` |
| `WHISPER_DEFAULT_LANGUAGE` | Default language | `en` | `en`, `it`, `fr`, `es`, `de` |
| `SUPPORTED_LANGUAGES` | Supported languages | `en,it,fr,es,de` | Comma-separated list |
| `NODE_ENV` | Environment | `development` | `development`, `production` |

### Model Selection

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny` | ~39MB | Fastest | Basic | Quick testing, real-time |
| `base` | ~74MB | Fast | Good | Balanced performance |
| `small` | ~244MB | Medium | Better | Most applications |
| `medium` | ~769MB | Slow | High | High accuracy needs |
| `large` | ~1550MB | Slowest | Best | Maximum accuracy |

### Language Support

- **English** (`en`) - Default
- **Italian** (`it`)
- **French** (`fr`)
- **Spanish** (`es`)
- **German** (`de`)

Additional languages can be added by modifying the `SUPPORTED_LANGUAGES` environment variable and updating the frontend options.

## Usage

1. **Select Configuration:**
   - Choose model size (tiny to large)
   - Select target language

2. **Record Audio:**
   - Click "🎤 Start Recording"
   - Allow microphone access
   - Speak clearly
   - Click "⏹ Stop Recording"

3. **Get Results:**
   - Transcription starts automatically
   - View results in the transcript area
   - Download audio (💾) or text (📄)

## Docker Commands

### Development

```bash
# Start development environment
docker compose -f docker.compose.yml -f docker.compose.dev.yml up

# Start in background
docker compose -f docker.compose.yml -f docker.compose.dev.yml up -d

# View logs
docker compose -f docker.compose.yml -f docker.compose.dev.yml logs -f

# Stop services
docker compose -f docker.compose.yml -f docker.compose.dev.yml down
```

### Production

```bash
# Start production environment
docker compose -f docker.compose.yml -f docker.compose.prod.yml up -d

# View logs
docker compose -f docker.compose.yml -f docker.compose.prod.yml logs -f

# Restart services
docker compose -f docker.compose.yml -f docker.compose.prod.yml restart

# Stop services
docker compose -f docker.compose.yml -f docker.compose.prod.yml down
```

### Maintenance

```bash
# Update images
docker compose pull

# Rebuild frontend
docker compose build frontend

# Clean up
docker compose down -v
docker system prune -f

# View service status
docker compose ps
```

## API Endpoints

### Health Check
```
GET /api/health
```
Returns service status and configuration.

### Transcription
```
POST /api/transcribe?model=base&language=en
Content-Type: multipart/form-data
Body: audio file
```

**Parameters:**
- `model`: Whisper model size (`tiny`, `base`, `small`, `medium`, `large`)
- `language`: Target language (`en`, `it`, `fr`, `es`, `de`)

**Response:**
```json
{
  "transcript": "Transcribed text",
  "language": "en",
  "model": "base",
  "confidence": 0.95,
  "size": 1024,
  "filename": "recording.mp3"
}
```

**Error Responses:**
- `400`: Invalid model or unsupported language
- `408`: Request timeout
- `422`: Audio processing error
- `500`: Internal server error

## Troubleshooting

### Common Issues

#### Services won't start
```bash
# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :9000

# Check Docker status
docker --version
docker compose version
```

#### Whisper backend fails to start
```bash
# Check logs
docker compose logs whisper-backend

# Common causes:
# - Insufficient memory (needs ~2GB for larger models)
# - Model download timeout
# - Port conflicts
```

#### Frontend can't connect to backend
```bash
# Check network connectivity
docker compose exec frontend ping whisper-backend

# Verify environment variables
docker compose exec frontend env | grep WHISPER
```

#### Audio recording not working
- Check browser permissions for microphone
- Use Chrome/Edge for best compatibility
- Ensure HTTPS in production (required for microphone access)

#### Transcription errors
```bash
# Check backend logs
docker compose logs whisper-backend

# Common issues:
# - Unsupported audio format
# - File too large (10MB limit)
# - Language not supported
# - Model not loaded
```

### Performance Tuning

#### Memory Usage
```yaml
# In docker.compose.prod.yml
deploy:
  resources:
    limits:
      memory: 2G  # Adjust based on model size
    reservations:
      memory: 1G
```

#### Model Loading
- First transcription may be slow (model loading)
- Subsequent requests are faster
- Use persistent volumes to cache models

#### Network Optimization
```yaml
# Add to docker.compose.yml
networks:
  whisper-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Logs and Debugging

```bash
# View all logs
docker compose logs

# Follow specific service
docker compose logs -f frontend
docker compose logs -f whisper-backend

# Debug container
docker compose exec frontend sh
docker compose exec whisper-backend sh

# Check health status
curl http://localhost:3000/api/health
```

## Migration from Local Setup

If you're migrating from the local Whisper.cpp setup:

1. **Backup your data** (if any)
2. **Remove old dependencies:**
   ```bash
   rm -rf whisper.cpp/
   rm whisper
   rm -rf models/
   rm setup-whisper.sh
   ```
3. **Follow the Docker setup** above
4. **Update any custom configurations**

## Security Considerations

### Development
- Services exposed on localhost only
- Debug logging enabled
- No authentication required

### Production
- Use HTTPS with your nginx proxy
- Implement authentication if needed
- Monitor resource usage
- Regular security updates:
  ```bash
  docker compose pull
  docker compose up -d
  ```

### Data Privacy
- Audio files processed in memory only
- No persistent storage of recordings
- Temporary files cleaned automatically
- All processing happens locally (no external APIs)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test with Docker
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Docker logs
3. Open an issue on GitHub

---

**Note:** This application processes audio entirely locally using Docker containers. No data is sent to external services, ensuring privacy and security.
