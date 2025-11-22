FROM node:20-alpine

# Install pnpm and wget for healthcheck
RUN npm install -g pnpm && \
    apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy all files (package.json will be available via volume mount in dev)
# This COPY is mainly for initial dependency installation
COPY . .

# Install dependencies (use --no-frozen-lockfile for dev flexibility)
RUN if [ -f package.json ]; then pnpm install; else echo "No package.json found, skipping install"; fi

# Expose port
EXPOSE 3001

# Start dev server with hot reload (install deps if package.json exists)
CMD sh -c 'if [ -f package.json ]; then echo "Installing dependencies..." && pnpm install; fi && exec pnpm dev'

