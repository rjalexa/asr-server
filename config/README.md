# Configuration Files

This directory contains environment configuration files for the ASR Server project.

## Files

- **.env.development**: Development environment variables
- **.env.production**: Production environment variables  
- **.env.example**: Example environment file with all available variables

## Environment Variables

### Whisper Configuration
- `WHISPER_API_URL`: URL of the Whisper backend service
- `WHISPER_MODEL`: Whisper model to use (tiny, base, small, medium, large)
- `WHISPER_DEFAULT_LANGUAGE`: Default language for transcription
- `SUPPORTED_LANGUAGES`: Comma-separated list of supported languages

### ASR Direct Access Configuration
- `ASR_EXTERNAL_PORT`: External port for the ASR service
- `ASR_RATE_LIMIT_PER_MINUTE`: Rate limit per API key per minute
- `ASR_RATE_LIMIT_BURST`: Burst limit for rate limiting
- `ASR_SECRETS_FILE`: Path to the secrets file containing API keys

### Next.js Configuration
- `NODE_ENV`: Node environment (development/production)
- `NEXT_PUBLIC_API_BASE_URL`: Public API base URL for frontend

## Usage

Environment files are automatically loaded based on the NODE_ENV:
- Development: Uses `.env.development`
- Production: Uses `.env.production`

The Docker compose files reference these environment variables for service configuration.

## Security Note

Never commit actual API keys or sensitive data to these files. Use the `.secrets` file in the project root for API keys, which is gitignored.
