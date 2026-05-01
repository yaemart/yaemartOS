#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: ./scripts/migration/run-path-a-homtone.sh <input-json-file>"
  exit 1
fi

INPUT_FILE="$1"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Input file not found: $INPUT_FILE"
  exit 1
fi

echo "▶ Build @yaemartos/api"
pnpm --filter @yaemartos/api build

echo "▶ Run Path A import (Homtone US Amazon)"
node "apps/api/dist/migration/path-a/path-a-runner.js" "$INPUT_FILE"
