#!/usr/bin/env bash
# ==============================================================================
# Production Deployment Script for AWS EC2
# Usage: ./scripts/deploy.sh [IMAGE_TAG] [IMAGE_REPO]
# Example: ./scripts/deploy.sh sha-a1b2c3d httpsvishal/todo-ci-cd
# ==============================================================================
set -euo pipefail

# 1. Configuration & Tag Resolution
DEPLOY_TAG="${1:-latest}"
REPO_NAME="${2:-}"

# If repo name is not provided, detect from git origin or environment
if [ -z "$REPO_NAME" ]; then
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    REPO_NAME="${GITHUB_REPOSITORY}"
  elif git config --get remote.origin.url >/dev/null 2>&1; then
    REPO_NAME=$(git config --get remote.origin.url | sed -E 's/.*github\.com[:\/](.*)\.git/\1/' | tr '[:upper:]' '[:lower:]')
  else
    REPO_NAME="httpsvishal/todo-ci-cd"
  fi
fi

# Lowercase repo name
REPO_NAME=$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]')

echo "=============================================="
echo "==> Starting Production Deployment"
echo "==> Repository: ghcr.io/${REPO_NAME}"
echo "==> Target Tag: ${DEPLOY_TAG}"
echo "==> Timestamp:  $(date -u '+%Y-%m-%d %H:%M:%SZ')"
echo "=============================================="

# 2. Memory Protection: Ensure 1GB Swap space on AWS Free Tier
if [ ! -f /swapfile ] && command -v sudo >/dev/null 2>&1; then
  echo "==> Configuring 1GB swap space on server..."
  sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile || true
fi

# 3. Track Deploy History for Rollbacks
if [ -f .current_tag ]; then
  cp .current_tag .previous_tag
fi
echo "$DEPLOY_TAG" > .current_tag

# 4. Export Image Variables for Docker Compose
export BACKEND_IMAGE="ghcr.io/${REPO_NAME}/backend:${DEPLOY_TAG}"
export FRONTEND_IMAGE="ghcr.io/${REPO_NAME}/frontend:${DEPLOY_TAG}"

echo "==> Backend Image:  ${BACKEND_IMAGE}"
echo "==> Frontend Image: ${FRONTEND_IMAGE}"

# 5. Pull Pre-built Images from GHCR (Zero Server-side Compilation)
echo "==> Pulling versioned images from registry..."
docker compose pull backend frontend

# 6. Apply Atomic Rolling Update
echo "==> Launching updated containers with Docker Compose..."
docker compose up -d --remove-orphans

# 7. Safe Cleanup of Dangling Layers
echo "==> Pruning dangling images..."
docker image prune -f

# 8. Local Service Health Verification
echo "==> Verifying backend health..."
HEALTH_URL="http://127.0.0.1:4000/tasks"
MAX_ATTEMPTS=30
ATTEMPT=1

until [ "$ATTEMPT" -gt "$MAX_ATTEMPTS" ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)
  if [ "$STATUS" = "200" ]; then
    echo "==> Backend API is up and healthy (HTTP 200)!"
    break
  fi
  echo "==> Waiting for backend to become ready... (attempt $ATTEMPT/$MAX_ATTEMPTS, status: $STATUS)"
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$ATTEMPT" -gt "$MAX_ATTEMPTS" ]; then
  echo "❌ Error: Backend healthcheck failed after ${MAX_ATTEMPTS} attempts!"
  docker compose logs backend
  exit 1
fi

echo "=============================================="
echo "==> Deployment of ${DEPLOY_TAG} completed successfully!"
echo "=============================================="
