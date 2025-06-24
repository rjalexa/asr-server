# ASR Server - Comprehensive Documentation

A production-ready ASR (Automatic Speech Recognition) server built with Next.js and OpenAI Whisper, featuring API key authentication, rate limiting, and comprehensive Swagger documentation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [Project Structure](#project-structure)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Development Guide](#development-guide)
7. [Production Deployment](#production-deployment)
8. [Security Features](#security-features)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Project History](#project-history)
12. [Contributing](#contributing)

## Architecture Overview

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │   Frontend      │    │   Whisper       │
│   Request       │───▶│   Container     │───▶│   Backend       │
│                 │    │   (Port 3001/   │    │   (Internal     │
│                 │    │    9001)        │    │    Network)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   API Key Auth  │
                       │   Rate Limiting │
                       │   Validation    │
                       └─────────────────┘
```

### Security Model

- ✅ Whisper backend only accessible via internal Docker network
- ✅ All external access through protected API endpoints
- ✅ API key authentication and rate limiting
- ✅ Request validation and comprehensive error handling

## Quick Start Guide

### Prerequisites

#### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Install curl (usually pre-installed)
brew install curl
```

#### Ubuntu/Debian Linux
```bash
# Update package list
sudo apt-get update

# Install Docker and Docker Compose
sudo apt-get install docker.io docker-compose-plugin curl

# Add user to docker group (optional, to avoid sudo)
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

#### System Requirements
- **Disk Space**: At least 5GB (for Whisper models)
- **Memory**: 4GB+ recommended for optimal performance
- **CPU**: Multi-core recommended for faster transcription

### Development Setup

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd asr-server
   ```

2. **Run development environment**:
   ```bash
   ./scripts/dev-setup.sh
   ```

3. **Access the application**:
   - Frontend: http://localhost:3001
   - Swagger UI: http://localhost:3001/docs
   - API Documentation: http://localhost:3001/api/docs

### Production Deployment

1. **Prepare production environment**:
   ```bash
   # Create production API keys in .secrets file
   echo "ASR_API_KEY_1=your_production_key_here" > .secrets
   ```

2. **Deploy to production**:
   ```bash
   ./scripts/prod-deploy.sh
   ```

3. **Access production services**:
   - Frontend: http://localhost:9001
   - Swagger UI: http://localhost:9001/docs

## Project Structure

### Current Organization

```
asr-server/
├── config/                    # Configuration files
│   ├── .env.development      # Development environment variables
│   ├── .env.production       # Production environment variables
│   ├── .env.example          # Example environment template
│   └── README.md             # Configuration documentation
├── docker/                    # Docker configurations
│   ├── .dockerignore         # Docker ignore file
│   ├── docker.compose.yml    # Base Docker Compose
│   ├── docker.compose.dev.yml # Development configuration
│   ├── docker.compose.prod.yml # Production configuration
│   ├── development/          # Development Docker files
│   │   └── Dockerfile.dev    # Development Dockerfile
│   ├── production/           # Production Docker files
│   │   └── Dockerfile.prod   # Production Dockerfile
│   └── README.md             # Docker documentation
├── scripts/                   # Deployment and management scripts
│   ├── dev-setup.sh          # Development environment setup
│   ├── prod-deploy.sh        # Production deployment
│   └── README.md             # Scripts documentation
├── pages/                     # Next.js pages and API routes
│   ├── api/v1/               # Versioned API endpoints
│   │   ├── asr.js            # Main ASR endpoint
│   │   ├── detect-language.js # Language detection
│   │   └── transcribe-direct.js # Enhanced transcription
│   ├── docs.js               # Swagger UI page
│   └── index.js              # Frontend homepage
├── components/                # React components
├── lib/                       # Utility libraries
├── models/                    # Data models
├── nginx/                     # Nginx configuration
├── public/                    # Static assets
├── .secrets                   # API keys (create this file)
├── package.json              # Node.js dependencies
├── next.config.mjs           # Next.js configuration
└── README.md                  # Main documentation
```

### Benefits of Current Structure

1. **Better Organization**: Clear separation between Docker configs, environment configs, and scripts
2. **No Duplication**: All files are in their appropriate directories with no duplicates
3. **Easier Navigation**: Developers can quickly find what they need
4. **Maintainability**: Related files are grouped together
5. **Documentation**: Each major directory has its own README

## Configuration

### Environment Files

Environment configuration files are stored in the `config/` directory:

#### Development (config/.env.development)
```bash
WHISPER_API_URL=http://whisper-backend:9000
WHISPER_MODEL=base
WHISPER_DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,it,fr,es,de
```

#### Production (config/.env.production)
```bash
WHISPER_API_URL=http://whisper-backend:9000
WHISPER_MODEL=base
WHISPER_DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,it,fr,es,de
ASR_RATE_LIMIT_PER_MINUTE=30
ASR_SECRETS_FILE=.secrets
NODE_ENV=production
```

### API Keys (.secrets)

Create a `.secrets` file with your API keys:
```bash
ASR_API_KEY_1=asr_prod_your_secure_key_here
ASR_API_KEY_2=asr_backup_another_key_here
ASR_API_KEY_3=asr_dev_development_key_here
```

#### Automatic Permission Handling

The production Docker container automatically handles file permissions for the `.secrets` file:

- **Container Startup**: An entrypoint script runs as root to fix permissions
- **Permission Fix**: Sets `chmod 644` and `chown nextjs:nodejs` on the mounted `.secrets` file
- **Security**: Switches to non-root `nextjs` user after fixing permissions
- **Reliability**: Ensures authentication works regardless of host file permissions

This eliminates the need for manual permission fixes when deploying or updating the application.

### Port Configuration

| Environment | Frontend Port | Backend Access | Use Case |
|-------------|---------------|----------------|----------|
| Development | 3001          | Internal only  | Local development |
| Production  | 9001          | Internal only  | Production deployment |
| Default     | 3000          | Internal only  | Testing/fallback |

## API Reference

### v1 API Endpoints (Recommended)

#### ASR - Automatic Speech Recognition
```bash
POST /api/v1/asr
```
- **Headers**: `X-API-Key: your_api_key`
- **Body**: `multipart/form-data` with `audio_file`
- **Query Parameters**:
  - `language`: `en|it|fr|es|de` (default: `en`)
  - `model`: `tiny|base|small|medium|large` (default: `base`)
  - `task`: `transcribe|translate` (default: `transcribe`)
  - `output`: `json|text` (default: `json`)

#### Language Detection
```bash
POST /api/v1/detect-language
```
- **Headers**: `X-API-Key: your_api_key`
- **Body**: `multipart/form-data` with `audio_file`

#### Enhanced Transcription
```bash
POST /api/v1/transcribe-direct
```
- **Headers**: `X-API-Key: your_api_key`
- **Body**: `multipart/form-data` with `audio` field
- **Query Parameters**:
  - `language`: `en|it|fr|es|de` (default: `en`)
  - `model`: `tiny|base|small|medium|large` (default: `base`)

### Documentation Endpoints
- `GET /docs` - Interactive Swagger UI
- `GET /api/docs` - OpenAPI specification
- `GET /api/health` - Health check

## Development Guide

### Local Development

```bash
# Start development environment
./scripts/dev-setup.sh

# View logs
docker compose -f docker/docker.compose.dev.yml logs -f

# Stop services
docker compose -f docker/docker.compose.dev.yml down

# Clean restart
./scripts/dev-setup.sh --clean
```

### Alternative npm Scripts

```bash
# Development
npm run setup:dev
npm run docker:dev        # Start dev environment
npm run docker:logs:dev   # View dev logs

# Production
npm run setup:prod
npm run docker:prod       # Start prod environment
npm run docker:logs:prod  # View prod logs
```

### Development Workflow

1. Make changes to code
2. Services auto-reload (Next.js hot reload)
3. Test using Swagger UI or curl commands
4. Check logs for any issues
5. Commit changes

## Production Deployment

### Deployment Steps

```bash
# Deploy to production
./scripts/prod-deploy.sh

# Update deployment
./scripts/prod-deploy.sh --update

# View logs
docker compose -f docker/docker.compose.prod.yml logs -f

# Monitor resources
docker stats

# Stop services
docker compose -f docker/docker.compose.prod.yml down
```

### Production Hardening

- ✅ Non-root user in containers
- ✅ Resource limits configured
- ✅ Health checks implemented
- ✅ Log rotation setup
- ✅ Security headers configured

### Backup and Recovery

```bash
# Backup API keys
cp .secrets .secrets.backup

# Backup Docker volumes
docker run --rm -v whisper-models:/data -v $(pwd):/backup alpine tar czf /backup/whisper-models.tar.gz -C /data .

# Restore Docker volumes
docker run --rm -v whisper-models:/data -v $(pwd):/backup alpine tar xzf /backup/whisper-models.tar.gz -C /data
```

## Security Features

### API Key Authentication
- All endpoints require valid API key in `X-API-Key` header
- Keys stored in gitignored `.secrets` file
- Server-side validation for all requests

### Rate Limiting
- 30 requests per minute per API key
- Burst protection (5 additional requests)
- Rate limit headers in responses

### Request Validation
- File type validation (audio files only)
- File size limits (50MB maximum)
- Request method validation
- Parameter validation

### Network Security
- Whisper backend isolated to internal Docker network
- No direct host access to ASR service
- All external access through protected frontend

## Testing

### Using curl

```bash
# Get your API key
API_KEY=$(grep "ASR_API_KEY_1" .secrets | cut -d'=' -f2)

# Test ASR endpoint
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -F "audio_file=@your-audio.mp3" \
  "http://localhost:3001/api/v1/asr?language=en&output=json"

# Test language detection
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -F "audio_file=@your-audio.mp3" \
  "http://localhost:3001/api/v1/detect-language"

# Test enhanced transcription
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -F "audio=@your-audio.mp3" \
  "http://localhost:3001/api/v1/transcribe-direct?language=en"
```

### Using Swagger UI

1. Open http://localhost:3001/docs (dev) or http://localhost:9001/docs (prod)
2. Click "Authorize" and enter your API key
3. Test endpoints with audio files directly in the browser

### Test Scripts

Both setup scripts include comprehensive testing:
- ✅ Prerequisites check
- ✅ Service health verification
- ✅ API endpoint testing
- ✅ Swagger UI accessibility
- ✅ Authentication validation

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker status
docker info

# Check service logs
docker compose -f docker/docker.compose.dev.yml logs

# Restart Docker (macOS/Windows)
# Restart Docker Desktop application

# Restart Docker (Linux)
sudo systemctl restart docker
```

#### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3001  # or :9001 for production

# Kill process using port
sudo kill -9 <PID>

# Or use different configuration
./scripts/dev-setup.sh  # Uses port 3001
```

#### API Key Issues
```bash
# Check .secrets file format
cat .secrets

# Ensure no extra spaces or characters
# Format: ASR_API_KEY_1=your_key_here

# Restart services after key changes
docker compose -f docker/docker.compose.dev.yml restart
```

#### Authentication Permission Issues
If you encounter "Invalid API key" errors even with correct keys:

```bash
# Check if .secrets file is mounted in container
docker compose -f docker/docker.compose.prod.yml exec frontend ls -la /app/.secrets

# Check file permissions on host
ls -la .secrets

# For production: rebuild container to apply entrypoint script
docker compose -f docker/docker.compose.prod.yml down
docker compose -f docker/docker.compose.prod.yml build --no-cache
docker compose -f docker/docker.compose.prod.yml up -d

# For development: fix permissions manually if needed
chmod 644 .secrets
```

The production container automatically fixes permissions via an entrypoint script, but development environments may require manual permission fixes.

#### Whisper Backend Not Ready
- Whisper backend can take 30-60 seconds to initialize
- Check logs: `docker compose logs whisper-backend`
- Ensure sufficient memory (4GB+ recommended)

#### Permission Issues (Linux)
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then test
docker run hello-world
```

### Performance Optimization

#### For Better Performance
- Use SSD storage for Docker volumes
- Allocate more memory to Docker (8GB+ recommended)
- Use faster Whisper models (`small`, `medium`, `large`)
- Consider GPU acceleration for production workloads

#### Resource Monitoring
```bash
# Monitor container resources
docker stats

# Check disk usage
docker system df

# Clean up unused resources
docker system prune
```

## Project History

### Recent Reorganization

The project underwent a major reorganization to improve structure and eliminate duplication:

#### Before Reorganization
- Docker compose files were in the root directory
- Environment files were scattered
- Multiple documentation files with overlapping content
- Legacy scripts and binaries

#### After Reorganization
- All Docker files consolidated in `docker/` directory
- Environment files organized in `config/` directory
- Scripts organized in `scripts/` directory
- Single comprehensive documentation
- Clean, maintainable structure

### Removed Legacy Files
- `test-docker-setup.sh` → Replaced with `scripts/dev-setup.sh`
- `setup-asr-api.sh` → Functionality moved to scripts
- `setup-whisper.sh` → No longer needed
- `migrate-to-docker.sh` → No longer needed
- `DOCKER_SETUP_FIXED.md` → Merged into documentation
- `API_V1_SUMMARY.md` → Merged into documentation
- `ASR_API_SETUP.md` → Merged into documentation
- `whisper` binary → Using Docker only

### Fixed Issues
1. **Docker Network Configuration**: All environments now use proper internal networking
2. **Port Configuration**: Clear separation between development and production ports
3. **API Endpoints**: All v1 endpoints fixed with proper error handling
4. **Environment Variables**: Consistent across all configurations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both development and production scripts
5. Submit a pull request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation as needed
- Test in both development and production environments

## Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Update development environment
./scripts/dev-setup.sh --clean

# Update production deployment
./scripts/prod-deploy.sh --update
```

### Monitoring and Logging

#### Log Management
- Logs are automatically rotated in production
- View real-time logs: `docker compose logs -f`
- Log files location: `/var/lib/docker/containers/`

#### Health Monitoring
- Health endpoint: `/api/health`
- Service status: `docker compose ps`
- Resource usage: `docker stats`

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Docker and application logs
3. Verify API key configuration
4. Test with provided curl commands
5. Check GitHub issues for similar problems

## License

[Add your license information here]

---

**Note**: This ASR server is designed for production use with proper security, monitoring, and deployment practices. The Whisper backend is securely isolated and only accessible through authenticated API endpoints.
