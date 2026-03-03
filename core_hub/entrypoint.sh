#!/bin/sh

echo "Waiting for PostgreSQL to start..."

while ! nc -z db 5432; do
  sleep 0.1
done

echo "PostgreSQL started"

# Run migrations
python manage.py migrate --noinput

# Collect static files (optional, good for production with gunicorn)
python manage.py collectstatic --noinput

exec "$@"
