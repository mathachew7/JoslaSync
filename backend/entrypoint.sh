#!/bin/sh
set -e

# Runs as root (container default) so it can fix ownership of named volumes
# that predate the non-root user switch, then drops to appuser before exec.
mkdir -p /app/static/logos /app/static/signatures /app/logs
chown -R appuser:appuser /app/static /app/logs

exec su -s /bin/sh appuser -c "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"
