#!/usr/bin/env bash
# Limpia artefactos locales de Playwright; NO borra /opt/cursor/artifacts.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$RAIZ"
rm -rf test-results playwright-report blob-report
echo "OK  test-results y playwright-report eliminados del repo (evidencia archivada queda en /opt/cursor/artifacts/verify-suitpay)."
