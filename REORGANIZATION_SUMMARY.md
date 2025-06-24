# Project Reorganization Summary

## Overview
The ASR Server project has been reorganized to improve structure, eliminate duplication, and create a cleaner separation of concerns.

## Changes Made

### 1. Docker Files Organization
**Before:**
- Docker compose files were in the root directory
- `.dockerignore` was in the root directory

**After:**
- All Docker-related files moved to `docker/` directory:
  - `docker/.dockerignore`
  - `docker/docker.compose.yml`
  - `docker/docker.compose.dev.yml`
  - `docker/docker.compose.prod.yml`
  - `docker/development/Dockerfile.dev`
  - `docker/production/Dockerfile.prod`

### 2. Environment Files Organization
**Before:**
- Environment files were in the root directory

**After:**
- All environment files moved to `config/` directory:
  - `config/.env.development`
  - `config/.env.production`
  - `config/.env.example`

### 3. Scripts Organization
**Before:**
- Scripts were already in the `scripts/` directory

**After:**
- Scripts remain in `scripts/` directory but updated to reference new paths:
  - `scripts/dev-setup.sh` - Updated docker compose paths
  - `scripts/prod-deploy.sh` - Updated docker compose and env file paths

### 4. Updated File References

#### Docker Compose Files
- Updated build context from `.` to `..` (parent directory)
- Updated volume mounts from `.:/app` to `..:/app`

#### Shell Scripts
- Updated all `docker compose -f docker.compose.*.yml` to `docker compose -f docker/docker.compose.*.yml`
- Updated `.env.production` references to `config/.env.production`

#### Documentation
- Updated main `README.md` with new directory structure
- Added `docker/README.md` documenting Docker setup
- Added `config/README.md` documenting environment configuration
- Added `scripts/README.md` documenting available scripts

## Final Structure

```
asr-server/
├── config/                    # All configuration files
│   ├── .env.development
│   ├── .env.production
│   ├── .env.example
│   └── README.md
├── docker/                    # All Docker-related files
│   ├── .dockerignore
│   ├── docker.compose.yml
│   ├── docker.compose.dev.yml
│   ├── docker.compose.prod.yml
│   ├── development/
│   │   └── Dockerfile.dev
│   ├── production/
│   │   └── Dockerfile.prod
│   └── README.md
├── scripts/                   # All shell scripts
│   ├── dev-setup.sh
│   ├── prod-deploy.sh
│   └── README.md
├── [application directories]  # Unchanged
│   ├── components/
│   ├── lib/
│   ├── models/
│   ├── nginx/
│   ├── pages/
│   └── public/
├── [root files]              # Remaining in root
│   ├── .secrets              # API keys (gitignored)
│   ├── package.json
│   ├── next.config.mjs
│   └── README.md
```

## Benefits

1. **Better Organization**: Clear separation between Docker configs, environment configs, and scripts
2. **No Duplication**: All files are in their appropriate directories with no duplicates
3. **Easier Navigation**: Developers can quickly find what they need
4. **Maintainability**: Related files are grouped together
5. **Documentation**: Each major directory has its own README

## Usage

The reorganization is transparent to users:

```bash
# Development setup (unchanged)
./scripts/dev-setup.sh

# Production deployment (unchanged)
./scripts/prod-deploy.sh
```

All scripts handle the new paths internally, so no changes to workflows are required.
