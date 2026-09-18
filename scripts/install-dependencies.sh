#!/usr/bin/env bash
set -euo pipefail

"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install-backend.sh"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install-frontend.sh"

echo "All dependencies installed"
