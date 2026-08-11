# Implementation Plan: Ranking de productos

**Branch**: `004-ranking-productos` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

## Summary

Contadores diarios en IndexedDB por vendedor; empujón diferido al cruzar el día America/Lima (idle post-paint / focus), merge idempotente en Firestore; página admin/jefe con top 20 (7/30 días). Sin Cloud Scheduler.

## Technical Context

**Language/Version**: TypeScript / TanStack Start (app única SuitPay).

**Primary Dependencies**: idb (IndexedDB), Zustand si conviene, `createServerFn`, Firestore Admin (`FieldValue.increment` o merge transaccional).

**Storage**: IndexedDB local `suitpay` (store nuevo `ranking-dia`); Firestore p.ej. `estadisticas/productos/{yyyy-mm-dd}` o `ranking/dias/{fecha}/productos/{codigo}` con totales por código y desglose opcional por `vendedorId`.

**Testing**: Vitest (idempotencia de lote, cambio de día); emulador para merge; sin cron e2e.

**Target Platform**: web.

**Constraints**: no bloquear mostrador; principio IV; sin Scheduler (decisión 10 de `001`).

**Scale/Scope**: 5 vendedores, ~500 SKUs, un empujón/día/puesto.

## Constitution Check

| # | Puerta | Estado |
|---|--------|--------|
| I | Ranking no emite/anula | **pass** |
| II | No afecta correlativos; anulación ajusta contadores con cuidado | **pass** |
| III | n/a proveedor | **n/a** |
| IV | Solo códigos/cantidades | **pass** |
| V | Empujón diferido, no bloquea | **pass** |
| VI | No afirmar mejora de surtido sin línea base | **pass** |
| — | Sin Scheduler | **pass** |

## Empujón (diseño comprometido)

```text
emitir → IndexedDB[vendedor][fechaLima][codigo] += cantidad
app ready → si fechaPendiente < hoyLima → idle → serverFn(loteId, deltas) → reset local
visibility/focus → misma comprobación
```

Corrección post-empujón (anulación de día ya cerrado): serverFn que aplica delta negativo sobre el doc del día del comprobante, keyed por `comprobanteId` para idempotencia.

## Project Structure

```text
specs/004-ranking-productos/
├── plan.md
├── spec.md
├── data-model.md
├── tasks.md
└── checklists/requirements.md

src/ (al implementar)
├── infra/local/ranking.ts
├── features/ranking/
├── server/ranking/
└── routes/administracion/ranking.tsx
```

## Complexity Tracking

Vacío — sin violaciones.
