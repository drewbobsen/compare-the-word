# ==========================================
# STAGE 1: Base (Used for Dev)
# ==========================================
FROM node:20-alpine AS base
WORKDIR /app
# Install all dependencies (including devDependencies)
COPY package.json package-lock.json ./
RUN npm install
# Copy the source code
COPY . .

# ==========================================
# STAGE 2: The Builder
# ==========================================
FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Compile the React code into static HTML/JS and generate the standalone server
RUN npm run build

# ==========================================
# STAGE 3: The Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy ONLY the necessary standalone files from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Run the lightweight Node server instead of the heavy 'npm run start'
CMD ["node", "server.js"]