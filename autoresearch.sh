#!/usr/bin/env bash
set -euo pipefail

cd /home/arvind/opencli

# Count non-utility chatgpt command files
FEATURE_COUNT=$(ls src/clis/chatgpt/*.ts 2>/dev/null | grep -v '/ax\.ts$' | wc -l | tr -d ' ')

# Type check
TYPECHECK_ERRORS=0
if ! npx tsc --noEmit 2>/tmp/tsc-errors.txt; then
    TYPECHECK_ERRORS=$(grep -c 'error TS' /tmp/tsc-errors.txt 2>/dev/null || echo 0)
    # Penalize compilation failures — zero out feature count
    FEATURE_COUNT=0
fi

echo "METRIC feature_count=$FEATURE_COUNT"
echo "METRIC typecheck_errors=$TYPECHECK_ERRORS"
