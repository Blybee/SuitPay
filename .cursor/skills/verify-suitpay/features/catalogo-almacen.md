# Catálogo e inventario orientativo (admin)

## Sub-features

- Lista publicada de productos (`/administracion/catalogo`).
- Importación (zona de carga, revisión en grilla).
- Cantidades orientativas / alertas (`listarAlertasInventarioFn`) — no inventario contable.
- Compras en disclosure (panel perezoso).

## Cómo llegar (POV usuario)

1. Sesión **administrador** o **jefe** (`admin@suitpay.local` / `admin1234` en emulador sembrado).
2. Navegar a `/administracion` → enlace catálogo, o directo `/administracion/catalogo`.
3. `GuardaSesion` con `roles={['administrador', 'jefe']}` redirige a `/` si el rol no basta.

## Driving con Playwright

No hay spec e2e admin hoy. Verificación típica:

```bash
# Reglas + servidor con emulador
npm run prueba:emulador
npm run prueba -- tests/unit/server/catalogo
```

Manual (con emuladores + sembrar):

1. `npm run emuladores` en tmux.
2. Sembrar: `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GOOGLE_CLOUD_PROJECT=demo-suitpay node scripts/sembrar-emulador.mjs`
3. Dev con vars emulador exportadas (ver `AGENTS.md` § modo emulador).
4. `/acceso` → admin → `/administracion/catalogo`.

## Gotchas

- Operaciones masivas importan vía server functions; requiere Admin SDK contra emulador (`GOOGLE_CLOUD_PROJECT=demo-suitpay`).
- Toasts Sileo (`usarNotificaciones`), no `role="alert"` fijo en cabecera.
- No confundir con catálogo en IndexedDB del mostrador (sembrado en e2e de pedido).
