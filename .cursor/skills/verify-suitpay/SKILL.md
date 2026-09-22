---
name: verify-suitpay
description: >
  Verificación end-to-end de SuitPay (TanStack Start + React, mostrador web).
  Usar cuando un agente deba arrancar la app real, comprobar el entorno (Doctor),
  conducir flujos de usuario con Playwright + Firebase emulators y archivar
  evidencia (traces, screenshots, logs). No sustituye speckit-implement ni npm run verificar.
---

# verify-suitpay

Skill project-local para **probar comportamiento como un vendedor en el navegador**, reutilizando el harness existente (`playwright.config.ts`, `tests/e2e/*`, `npm run prueba:e2e:completa`).

Mapa de flujos: [features/README.md](./features/README.md).

## Cuándo usarla

- Tras cambios en UI del mostrador, captura, emisión, vecinos, lista o admin catalogo.
- Para demostrar un fix con evidencia reproducible (no solo `npm run prueba` unitaria).
- Antes de cerrar una tarea donde AGENTS.md pide e2e o emuladores.

**No usar** para: planificar features (speckit-*), typecheck/lint (`npm run verificar`), humo del bundle Nitro (`npm run humo:produccion`) salvo que toques `vite.config.ts` / firebase-admin.

## Launch

### Dependencias

```bash
cd /workspace   # raíz del repo
npm install     # npm ci falla por lock desincronizado; ver AGENTS.md
npx playwright install chromium
```

Node **>= 22** (`engines`). Java **21+** para Firebase Emulator Suite.

### Modo recomendado: emuladores + Playwright (aislado)

Playwright arranca su propio `npm run dev` con variables demo (`playwright.config.ts` → `webServer.env`). No depende de `.env.local`.

```bash
npm run prueba:e2e:completa
# Equivalente granular:
npx firebase emulators:exec --project demo-suitpay --only firestore,auth,storage "playwright test"
```

Puertos emulador (por omisión):

| Servicio   | Puerto |
|-----------|--------|
| App dev (webServer) | 3000 o `PUERTO_PRUEBAS` |
| Firestore | 8080 |
| Auth      | 9099 |
| Storage   | 9199 |
| Emulator UI | 4000 |

### Modo manual (exploración humana / computerUse)

1. Crear `.env.local` demo (git-ignorado) — valores en `AGENTS.md` § modo emulador.
2. Terminal A: `npm run emuladores`
3. Sembrar:  
   `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GOOGLE_CLOUD_PROJECT=demo-suitpay node scripts/sembrar-emulador.mjs`
4. Terminal B — **exportar hosts emulador** (Vite no propaga al servidor):  
   `export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 GOOGLE_CLOUD_PROJECT=demo-suitpay PROVEEDOR_SIMULADO=true`  
   luego `npm run dev -- --host 0.0.0.0 --port 3000`
5. Abrir `/acceso` → `vendedor@suitpay.local` / `vendedor123`

Cloud Agent: `.cursor/environment.json` ya puede ocupar **3000**. No mates ese proceso; usa Playwright en **3001** vía scripts de esta skill.

### Aislamiento / no double-drive

- **No** ejecutes Playwright con `reuseExistingServer: true` contra un dev en 3000 con proyecto Firebase real mientras e2e usa `demo-suitpay`.
- **No** corras dos `emulators:exec` a la vez (puertos 8080/9099).
- Un agente = una suite e2e o un dev manual; otro agente debe usar otro `PUERTO_PRUEBAS` y su propio `emulators:exec`.

## Doctor

Comprueba Node, Java, Playwright, puertos y coherencia básica de `.env.local`:

```bash
node .cursor/skills/verify-suitpay/scripts/doctor.mjs
```

Salida `FALLO` → corregir antes de Drive. `AVISO` → leer mensaje (puerto 3000, falta `.env.local`, emuladores no iniciados).

Checks clave:

- `node_modules` presente.
- Java para `firebase emulators:exec`.
- Puerto 3000 ocupado → usar `drive-feature.sh` (elige 3001).
- `GOOGLE_CLOUD_PROJECT` vs `VITE_FIREBASE_PROJECT_ID` si existe `.env.local`.

## Drive

Conductor por feature (Playwright + emuladores en un solo comando):

```bash
bash .cursor/skills/verify-suitpay/scripts/drive-feature.sh vecinos
# o: pedido | pedido-emitir | cotizaciones-guia | dictado | fotografia
```

Detalle por flujo: [features/](./features/).

**Flujo mínimo de agente (checklist):**

1. `node .cursor/skills/verify-suitpay/scripts/doctor.mjs`
2. `bash .cursor/skills/verify-suitpay/scripts/drive-feature.sh <feature>`
3. Archivar evidencia (siguiente sección)
4. `bash .cursor/skills/verify-suitpay/scripts/cleanup-verificacion.sh`

### Selectores estables (mostrador)

| Elemento | Playwright |
|----------|------------|
| Buscar producto | `getByRole('combobox', { name: /Buscar producto/i })` |
| Tabs mostrador | `getByRole('tab', { name: 'Pedido' \| 'Vecinos' \| 'Lista' \| 'Cotizaciones' })` |
| Total | `getByLabel('Total del pedido')` |
| Emitir | `getByRole('button', { name: 'Emitir', exact: true })` |
| Login | `/acceso` — `getByLabel('Correo')`, `getByLabel('Contraseña')`, `getByRole('button', { name: 'Entrar' })` |

### Rutas file-based (`src/routes/`)

| Ruta | Uso |
|------|-----|
| `/` | Mostrador (tabs Pedido, Cotizaciones, Vecinos, Lista) |
| `/acceso` | Login |
| `/cotizaciones/` | Cotizaciones recuperadas |
| `/comprobantes` | Historial |
| `/administracion/catalogo` | Catálogo / inventario orientativo |
| `/administracion/*` | Admin (roles administrador/jefe) |

### Vitest (sin UI)

| Comando | Alcance |
|---------|---------|
| `npm run prueba` | dominio, servidor, interfaz |
| `npm run prueba:emulador` | reglas Firestore + emulador |
| `npm run tipos` | typecheck |

Usar cuando el cambio es solo dominio/servidor; Drive UI cuando toques `.tsx` del mostrador.

## Evidence

Tras Drive:

```bash
node .cursor/skills/verify-suitpay/scripts/archivar-evidencia.mjs
```

Copia `test-results/`, `playwright-report/` y logs bajo **`/opt/cursor/artifacts/verify-suitpay/`** (persisten tras cleanup del repo).

Observación adicional:

- Exit code del script Drive (`0` = pasó).
- Screenshots en fallo: `test-results/**/test-failed-*.png`
- Trace (CI / retry): configurado en `playwright.config.ts` (`trace: 'on-first-retry'`).
- Reporte HTML: `npx playwright show-report` antes de cleanup, o carpeta archivada.

Incluir rutas de artefactos en el PR o resumen al usuario.

## Cleanup

```bash
bash .cursor/skills/verify-suitpay/scripts/cleanup-verificacion.sh
```

Elimina `test-results/` y `playwright-report/` del workspace. **No** borra `/opt/cursor/artifacts/verify-suitpay/`.

No detengas emuladores manuales ni el dev de Cloud en 3000 salvo que tú los hayas iniciado para la prueba.

## Helpers

| Script | Función |
|--------|---------|
| [scripts/doctor.mjs](./scripts/doctor.mjs) | Pre-flight entorno |
| [scripts/puerto-pruebas.mjs](./scripts/puerto-pruebas.mjs) | Elige 3000 o 3001 libre |
| [scripts/drive-feature.sh](./scripts/drive-feature.sh) | `emulators:exec` + un spec e2e |
| [scripts/archivar-evidencia.mjs](./scripts/archivar-evidencia.mjs) | Copia a `/opt/cursor/artifacts` |
| [scripts/cleanup-verificacion.sh](./scripts/cleanup-verificacion.sh) | Limpia artefactos locales |

Código e2e reutilizable (no duplicar en scripts):

- `tests/e2e/ayudas-sesion.ts` — `sembrarSesionDeVendedor`, `entrarComoVendedorE2E`
- `tests/e2e/ayudas-vecino.ts` — siembra vecinos Firestore
- `scripts/sembrar-emulador.mjs` — usuarios demo manuales

## Blockers conocidos (cloud / local)

| Blocker | Síntoma | Mitigación |
|---------|---------|------------|
| Sin Java | `emulators:exec` falla | Instalar JDK; Doctor falla claro |
| Puerto 3000 ocupado | Playwright: «already used» | `drive-feature.sh` → 3001 |
| `.env.local` nube + token demo | `verifyIdToken` aud mismatch en logs | Solo emulators:exec; no dev paralelo en 3000 |
| Spec pedido sin sesión | Redirect `/acceso`, combobox ausente | Usar `vecinos` o añadir sesión al spec (ver [features/pedido.md](./features/pedido.md)) |
| Secretos producción | ADC / `PROVEEDOR_TOKEN` | Quedarse en emulador; documentar en PR |

## Referencias repo

- `AGENTS.md` — Cursor Cloud, emuladores, pruebas.
- `playwright.config.ts` — webServer, env demo, proyectos escritorio/móvil.
- `docs/BUNDLE-SERVIDOR.md` — si cambias Nitro/firebase-admin.
