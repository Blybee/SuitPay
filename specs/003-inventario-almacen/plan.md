# Implementation Plan: Inventario y almacén

**Branch**: `003-inventario-almacen` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-inventario-almacen/spec.md`

## Summary

Añadir existencias por producto, descuento idempotente al emitir, restauración al anular, alertas de stock bajo y ajuste admin. **No implementar código** hasta cerrar si SuitPay es fuente de verdad durante la convivencia.

## Technical Context

**Language/Version**: TypeScript (mismo monorepo TanStack Start que `001`).

**Primary Dependencies**: TanStack Start server functions, Firestore Admin SDK, dominio compartido en `src/domain/`.

**Storage**: Cloud Firestore. Preferencia: documento(s) de stock satélite o campos en `catalogo/actual` — decidir en research según tamaño (~500 SKUs) y coste de lecturas (una lectura de catálogo por sesión ya existe).

**Testing**: Vitest + emulador Firestore; pruebas de idempotencia emisión/anulación obligatorias si tocan flujo tributario.

**Target Platform**: web SuitPay.

**Project Type**: extensión de la app única.

**Performance Goals**: el descuento no añade latencia perceptible al mostrador (misma transacción o paso atómico inmediato post-registro).

**Constraints**: principio II (no descontar dos veces); principio V (aviso no bloqueante por defecto); sin Cloud Scheduler.

**Scale/Scope**: ~500 productos, 5 vendedores, un local.

## Constitution Check

| # | Puerta | Verificación | Estado |
|---|--------|--------------|--------|
| I | Aprobación humana | Stock no emite ni anula solo; ajustes admin son explícitos | **pass** |
| II | No documentar dos veces | Descuento atado a clave de idempotencia / estado del comprobante | **pass** |
| III | Proveedor sustituible | Inventario no toca el módulo frontera | **pass** / n/a |
| IV | Sin PII a IA | Solo códigos y cantidades | **pass** |
| V | Mostrador no se detiene | Alerta no bloquea emisión por defecto | **pass** |
| VI | Medir | No afirmar mejora de mermas sin línea base | **pass** |
| — | Dominio | Anulación restaura; no “eliminar” comprobantes | **pass** |
| — | Disciplina | Pruebas de reintento/anulación al tocar emisión | **pass** (cuando se implemente) |

**Resultado**: puertas pasan; **gate de producto abierto** (FR-007) bloquea Phase de implementación.

## Project Structure

```text
specs/003-inventario-almacen/
├── plan.md
├── spec.md
├── data-model.md
├── tasks.md
└── checklists/requirements.md

src/ (futuro, tras desbloqueo)
├── domain/inventario/
├── server/inventario/
└── routes/administracion/…  # alertas / ajustes
```

## Complexity Tracking

Sin violaciones constitucionales. Bloqueo es de producto (convivencia), no de constitución.
