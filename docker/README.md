# Docker Configuration

This directory contains all Docker-related files for the ASR Server project.

## Structure

```
docker/
├── .dockerignore              # Docker ignore file
├── docker.compose.yml         # Base docker compose configuration
├── docker.compose.dev.yml     # Development-specific configuration
├── docker.compose.prod.yml    # Production-specific configuration
├── development/
│   └── Dockerfile.dev         # Development Dockerfile
└── production/
    └── Dockerfile.prod        # Production Dockerfile
```

## Usage

### Development

To run the development environment:

```bash
# From the project root
./scripts/dev-setup.sh

# Or manually
docker compose -f docker/docker.compose.dev.yml up -d --build
```

### Production

To deploy to production:

```bash
# From the project root
./scripts/prod-deploy.sh

# Or manually
docker compose -f docker/docker.compose.prod.yml up -d --build
```

## Docker Compose Files

- **docker.compose.yml**: Base configuration with common settings
- **docker.compose.dev.yml**: Development overrides (port 3001, volume mounts for hot reload)
- **docker.compose.prod.yml**: Production overrides (port 9001, optimized builds, resource limits)

## Dockerfiles

- **development/Dockerfile.dev**: Development image with hot reload support
- **production/Dockerfile.prod**: Optimized production image with multi-stage build

## Notes

- All docker compose commands should be run from the project root directory
- The build context is set to the parent directory (..) to access project files
- Environment files are stored in the `config/` directory
- Scripts for managing deployments are in the `scripts/` directory
