# Scripts

This directory contains shell scripts for managing the ASR Server deployment.

## Available Scripts

### dev-setup.sh
Development environment setup script that:
- Checks prerequisites (Docker, Docker Compose)
- Creates API keys if needed
- Builds and starts development containers
- Runs health checks
- Displays service URLs and usage information

**Usage:**
```bash
./scripts/dev-setup.sh           # Normal setup
./scripts/dev-setup.sh --clean   # Clean setup (removes volumes)
./scripts/dev-setup.sh --help    # Show help
```

### prod-deploy.sh
Production deployment script that:
- Validates production environment
- Checks system resources
- Deploys production containers with optimizations
- Sets up monitoring and log rotation
- Provides security recommendations

**Usage:**
```bash
./scripts/prod-deploy.sh          # Normal deployment
./scripts/prod-deploy.sh --clean  # Clean deployment (removes volumes)
./scripts/prod-deploy.sh --update # Update existing deployment
./scripts/prod-deploy.sh --help   # Show help
```

### test-prod-build.sh
Test production build script that:
- Builds the production Docker image
- Starts the production container
- Tests the /docs endpoint
- Provides instructions for checking the documentation page

**Usage:**
```bash
./scripts/test-prod-build.sh      # Build and test production image
```

## Key Differences

| Feature | Development | Production |
|---------|-------------|------------|
| Port | 3001 | 9001 |
| Hot Reload | Yes | No |
| Resource Limits | No | Yes |
| Log Rotation | No | Yes |
| Restart Policy | No | unless-stopped |

## Prerequisites

Both scripts require:
- Docker and Docker Compose installed
- `.secrets` file with API keys in project root
- Sufficient disk space (5GB+ for Whisper models)
- Sufficient RAM (4GB+ recommended)

## Notes

- Scripts should be run from the project root directory
- All Docker files are located in the `docker/` directory
- Environment files are in the `config/` directory
- Scripts automatically handle path references
