#!/bin/sh

# Fix permissions for mounted .secrets file if it exists
if [ -f "/app/.secrets" ]; then
    echo "Fixing permissions for .secrets file..."
    # Make the file readable by the nextjs user
    chmod 644 /app/.secrets 2>/dev/null || echo "Could not change permissions, but continuing..."
    chown nextjs:nodejs /app/.secrets 2>/dev/null || echo "Could not change ownership, but continuing..."
fi

# Switch to nextjs user and execute the original command
exec su-exec nextjs "$@"
