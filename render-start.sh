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

# Exit when either process exits; Render will restart the service.
wait -n "$DJANGO_PID" "$NEXT_PID"
