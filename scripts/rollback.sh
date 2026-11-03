#!/usr/bin/env bash
# ==============================================================================
# Production Rollback Script for AWS EC2
# Usage: ./scripts/rollback.sh
# Reverts containers to the previous successfully deployed image tag.
# ==============================================================================
set -euo pipefail

if [ ! -f .previous_tag ]; then
  echo "❌ Error: No previous deployment record (.previous_tag) found to rollback to."
  exit 1
fi

PREVIOUS_TAG=$(cat .previous_tag)
CURRENT_TAG=$(cat .current_tag 2>/dev/null || echo "unknown")

echo "=============================================="
echo "==> Rolling back deployment"
echo "==> Current Tag:  ${CURRENT_TAG}"
echo "==> Rollback Tag: ${PREVIOUS_TAG}"
echo "=============================================="

# Invoke deploy.sh with the previous tag
./scripts/deploy.sh "${PREVIOUS_TAG}"
