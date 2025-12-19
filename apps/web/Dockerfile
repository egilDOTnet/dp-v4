FROM node:20-alpine

# Install pnpm, wget for healthcheck, and OpenSSL for Prisma
RUN npm install -g pnpm && \
    apk add --no-cache wget openssl openssl-dev

# Set working directory to workspace root
WORKDIR /workspace

# Copy all files (package.json will be available via volume mount in dev)
# Dependencies are installed at runtime via docker-compose command
COPY . .

# Expose port
EXPOSE 3000

# Start dev server (dependencies installed via docker-compose command)
CMD ["pnpm", "dev"]

