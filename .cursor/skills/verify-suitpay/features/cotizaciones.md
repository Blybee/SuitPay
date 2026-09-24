# Cotizaciones (cliente y guía)

## Sub-features

- Tab **Cotizaciones** en `/` (panel embebido).
- Ruta dedicada `/cotizaciones/` con búsqueda `?numero=` (`PanelDeCotizaciones`).
- Encadenar boleta + guía de remisión (`tests/e2e/guia.spec.ts`).
- Comprobantes emitidos: `/comprobantes`, detalle `/comprobantes/$comprobanteId`.

## Cómo llegar (POV usuario)

- Mostrador: tab **Cotizaciones** (etiqueta corta móvil: «Cotis»).
- Recuperar cotización guardada: `/cotizaciones/?numero=123`.
- Tras emitir: historial en `/comprobantes`.

## Driving con Playwright

Guía encadenada (parcialmente cubierta):

```bash
bash .cursor/skills/verify-suitpay/scripts/drive-feature.sh cotizaciones-guia
```

Spec `guia.spec.ts` usa combobox, opción «Bol + Guía R», heading «Guía de remisión».

Emisión / cotización completa: mismo stack que pedido (`venta-escrita`, emuladores, sesión).

## Gotchas

- `/cotizaciones/` lleva `GuardaSesion` (sesión obligatoria).
- Proveedor: e2e usa `PROVEEDOR_SIMULADO` solo si exportas `true`; por omisión proveedor demo real en config Playwright.
- Cambios tributarios: verificar reintento / respuesta ausente con `npm run prueba:emulador` y specs de emisión, no solo UI.
