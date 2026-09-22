# Mapa de features — verify-suitpay

Flujos visibles para el vendedor/administrador en la app web (TanStack Start). Las rutas salen de `src/routes/` y del mostrador en `/`.

| Feature | Ruta / superficie | Spec e2e relacionado | Script rápido |
|--------|-------------------|----------------------|---------------|
| [pedido](./pedido.md) | `/` → tab **Pedido** | `tests/e2e/venta-escrita.spec.ts` | `drive-feature.sh pedido` |
| [lista](./lista.md) | `/` → tab **Lista** | (Vitest + emulador reglas) | Manual + sesión |
| [vecinos](./vecinos.md) | `/` → tab **Vecinos** | `tests/e2e/vecinos.spec.ts` | `drive-feature.sh vecinos` |
| [catalogo-almacen](./catalogo-almacen.md) | `/administracion/catalogo` | Vitest dominio/servidor | Manual admin |
| [cotizaciones](./cotizaciones.md) | `/` tab **Cotizaciones** y `/cotizaciones/` | `tests/e2e/guia.spec.ts` (guía encadenada) | `drive-feature.sh cotizaciones-guia` |

**Orden sugerido para agentes:** Doctor → `drive-feature.sh vecinos` (emuladores + login UI) → ampliar con pedido/emitir según el cambio.

**Aislamiento:** no ejecutes Playwright contra un `npm run dev` en 3000 con `.env.local` de nube mientras usas tokens `demo-suitpay`. Usa `PUERTO_PRUEBAS` alternativo (ver skill principal).
