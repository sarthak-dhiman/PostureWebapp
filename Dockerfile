FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    DJANGO_SETTINGS_MODULE=core_hub.settings \
    API_URL=http://127.0.0.1:8000 \
    INTERNAL_API_URL=http://127.0.0.1:8000

WORKDIR /app

# Install backend + frontend system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Backend dependencies
COPY core_hub/requirements.txt /app/core_hub/requirements.txt
RUN pip install --no-cache-dir -r /app/core_hub/requirements.txt gunicorn

# Frontend dependencies
COPY frontend/package*.json /app/frontend/
RUN cd /app/frontend && if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source
COPY . /app

# Build Next.js app for production
RUN cd /app/frontend && npm run build

RUN chmod +x /app/render-start.sh

EXPOSE 3000
CMD ["/app/render-start.sh"]
