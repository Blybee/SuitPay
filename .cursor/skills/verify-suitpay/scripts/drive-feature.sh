#!/usr/bin/env bash
# Ejecuta un flujo e2e mapeado en features/*.md vía Playwright + Emulator Suite.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$RAIZ"

FEATURE="${1:-vecinos}"
PUERTO="$(node .cursor/skills/verify-suitpay/scripts/puerto-pruebas.mjs)"
export PUERTO_PRUEBAS="$PUERTO"
export URL_PRUEBAS="http://localhost:${PUERTO}"

case "$FEATURE" in
  pedido)
    CMD="playwright test tests/e2e/venta-escrita.spec.ts -g 'el pedido se toma escribiendo' --project=escritorio"
    ;;
  pedido-emitir)
    CMD="playwright test tests/e2e/venta-escrita.spec.ts -g 'la doble pulsación' --project=escritorio"
    ;;
  vecinos)
    CMD="playwright test tests/e2e/vecinos.spec.ts --project=escritorio"
    ;;
  cotizaciones-guia)
    CMD="playwright test tests/e2e/guia.spec.ts --project=escritorio"
    ;;
  dictado)
    CMD="playwright test tests/e2e/dictado.spec.ts --project=escritorio"
    ;;
  fotografia)
    CMD="playwright test tests/e2e/fotografia.spec.ts --project=escritorio"
    ;;
  *)
    echo "FALLO  Feature desconocida: $FEATURE" >&2
    echo "Valores: pedido | pedido-emitir | vecinos | cotizaciones-guia | dictado | fotografia" >&2
    exit 1
    ;;
esac

echo "INFO  PUERTO_PRUEBAS=$PUERTO  feature=$FEATURE"
npx firebase emulators:exec --project demo-suitpay --only firestore,auth,storage "$CMD"
