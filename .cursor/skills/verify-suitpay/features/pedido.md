# Pedido (mostrador)

## Sub-features

- Búsqueda fuzzy de productos (`combobox` «Buscar producto»).
- Líneas con precio negociable (`getByLabel('Precio de …')`).
- Tipos de documento: nota de venta, boleta, factura (`radio` con nombre visible).
- Total (`getByLabel('Total del pedido')`).
- Emisión (`button` «Emitir») — requiere sesión, serie y emuladores/proveedor.

## Cómo llegar (POV usuario)

1. Entrar en `/acceso` con vendedor (emulador: sembrar con `scripts/sembrar-emulador.mjs` → `vendedor@suitpay.local` / `vendedor123`, o flujo e2e `entrarComoVendedorE2E`).
2. Tras login, la app abre `/` con tab **Pedido** activo por defecto (`PestanasMostrador`).

## Driving con Playwright

Spec: `tests/e2e/venta-escrita.spec.ts`.

```bash
node .cursor/skills/verify-suitpay/scripts/doctor.mjs
bash .cursor/skills/verify-suitpay/scripts/drive-feature.sh pedido
# Emisión completa:
bash .cursor/skills/verify-suitpay/scripts/drive-feature.sh pedido-emitir
```

Patrones reutilizables del spec:

- Catálogo en IndexedDB: `sembrarCatalogo(page)` en el spec (store `catalogo`, DB `suitpay`).
- Búsqueda: `getByRole('combobox', { name: /Buscar producto/i })` → `getByRole('option').first()`.
- Líneas: `getByRole('listitem')`.

## Gotchas

- **`GuardaSesion` exige sesión en `/`.** El spec «el pedido se toma escribiendo» aún asume mostrador sin login; hoy redirige a `/acceso`. Para verificar pedido en UI usa `sembrarSesionDeVendedor` o `entrarComoVendedorE2E` (como la prueba de emisión) hasta que el spec se alinee.
- **`reuseExistingServer: false`** en `playwright.config.ts`: no reutilices un dev en 3000 con otro `GOOGLE_CLOUD_PROJECT`.
- Emisión: Java + `npm run prueba:e2e:completa` o `drive-feature.sh pedido-emitir`.
- Puerto 3000 ocupado en Cloud Agent: `PUERTO_PRUEBAS` lo resuelve `drive-feature.sh`.
