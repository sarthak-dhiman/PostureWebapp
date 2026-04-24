#!/bin/sh
set -eu

# Render assigns PORT dynamically; Next.js must listen on it.
export PORT="${PORT:-3000}"
export HOSTNAME="0.0.0.0"
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:8000}"
export API_URL="${API_URL:-$INTERNAL_API_URL}"

cd /app/core_hub
python manage.py migrate --noinput
python manage.py collectstatic --noinput
gunicorn --bind 127.0.0.1:8000 core_hub.wsgi:application &
DJANGO_PID=$!

cd /app/frontend
npm start &
NEXT_PID=$!

shutdown() {
  kill "$DJANGO_PID" "$NEXT_PID" 2>/dev/null || true
}

trap shutdown INT TERM

# POSIX-safe replacement for `wait -n` (not available in Debian dash /bin/sh).
while true; do
  if ! kill -0 "$DJANGO_PID" 2>/dev/null; then
    wait "$DJANGO_PID" || true
    shutdown
    exit 1
  fi
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    wait "$NEXT_PID" || true
    shutdown
    exit 1
  fi
  sleep 1
done
