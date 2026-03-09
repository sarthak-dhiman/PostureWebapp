# syntax=docker/dockerfile:1.4
FROM node:20-alpine

WORKDIR /app

# Copy package files first to leverage layer cache
COPY package*.json ./

# Use npm cache mount and prefer `npm ci` when lockfile exists
RUN --mount=type=cache,target=/root/.npm \
	sh -c "if [ -f package-lock.json ]; then npm ci; else npm install; fi"

# Copy remaining sources
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port 3000
EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

# Start the Next.js application
CMD ["npm", "start"]
