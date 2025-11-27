# Build stage
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Install Python and build tools (needed for @google-cloud/text-to-speech)
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Production stage
FROM node:20-slim AS runner

WORKDIR /usr/src/app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy from builder
COPY --from=builder /usr/src/app ./

# Create directories and set permissions
RUN mkdir -p /usr/src/app/public/audios /secrets && \
    chown -R node:node /usr/src/app

# Use non-root user
USER node

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]