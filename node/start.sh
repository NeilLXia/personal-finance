#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if [[ "${SKIP_MIGRATIONS:-}" != "1" ]]; then
  npm run db:migrate
fi

case "${1:-}" in
  production)
    npm run start:production
    ;;
  sandbox)
    npm run start:sandbox
    ;;
  "")
    npm start
    ;;
  *)
    echo "Usage: ./start.sh [sandbox|production]" >&2
    exit 64
    ;;
esac
