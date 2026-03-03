FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

RUN npm install

# Copy all files
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port 3000
EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

# Start the Next.js application
CMD ["npm", "start"]
