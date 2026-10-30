# Stage 1: Build the NestJS application
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source and config files
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build production bundle
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy generated Prisma Client & build artifacts from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
