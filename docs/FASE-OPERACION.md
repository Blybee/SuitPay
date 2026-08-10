# Fase de operación: DEMO vs PRODUCCION

Variable de entorno del **servidor** (sin prefijo `VITE_`):

```bash
SUITPAY_FASE=DEMO
```

Valores admitidos: `DEMO` (omisión) | `PRODUCCION` (también acepta `PRODUCTION`).

Código: [`src/server/fase-operacion.ts`](../src/server/fase-operacion.ts) → `faseOperacion()` / `esFaseDemo()`.

## Estado actual

**`SUITPAY_FASE=DEMO`** — vigente para pruebas manuales y presentación al gerente.

## Qué implica DEMO (medidas temporales)

### Series y establecimientos locales

El entorno demo del proveedor a menudo **no permite** crear/sincronizar series (o falla con errores genéricos). Para poder asignar boleta/factura a un vendedor de prueba y emitir en pruebas:

- En fase **DEMO**, el alta administrativa de series reguladas **persiste en Firestore** con un id sintético `demo-local-…` **sin exigir** que el proveedor acepte la serie.
- Si el listado/alta de establecimientos falla contra el proveedor, DEMO ofrece un establecimiento local de respaldo para poder completar el formulario.

Esto **no** sustituye la emisión real ante la autoridad. Para emitir sin token real usa además `PROVEEDOR_SIMULADO=true` (doble local). Con proveedor real + series solo en Firestore demo, la emisión puede fallar en el proveedor si la serie no existe allí.

### Obligatoriedad al lanzar

Antes de producción oficial:

1. Poner `SUITPAY_FASE=PRODUCCION` (App Hosting + `.env`).
2. Crear series/establecimientos **reales** vía el proveedor.
3. Retirar o dejar inerte cualquier dependencia de ids `demo-local-*`.

## Qué NO cambia con la fase

- Principios I–IV de la constitución.
- Frontera del proveedor (el nombre del proveedor no sale de su módulo).
- Idempotencia de emisión.

## Para agentes

- Si fallan altas de serie con mensaje de «datos oficiales» / proveedor: comprobar `SUITPAY_FASE` y si estamos en DEMO.
- No promover lógica DEMO a PRODUCCION.
- Notificaciones de UI: usar `usarNotificaciones().mostrar(…)` (Sileo / `Toaster` en raíz), no `<p role="alert">` al inicio de páginas largas. Ver `docs/UI-NOTIFICACIONES-Y-MIGAS.md`.
- Navegación interna admin: usar `MigasDePan`.
