# Tasks: Ranking de productos

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)  
**Prereq**: emisión (y anulación) de `001`.

## Phase 0: Fundación

- [ ] T001 Store IndexedDB + API local incrementar/decrementar por emisión/anulación
- [ ] T002 Utilidad `fechaLima()` reutilizando zona America/Lima de `001`
- [ ] T003 ServerFn `empujarRankingDia` idempotente por `loteId` + reglas (solo backend escribe agregados)

## Phase 1: Empujón diferido

- [ ] T004 Hook/bootstrap: tras primer paint / idle y en `visibilitychange`, si hay día pendiente → empujar sin bloquear UI
- [ ] T005 Pruebas: cambio de día, reintento mismo lote, fallo de red conserva bucket
- [ ] T006 Cablear incremento en éxito de emisión; ajuste en anulación (mismo día local vs día ya empujado)

## Phase 2: Admin UI

- [ ] T007 Ruta admin/jefe ranking: top 20 unidades, toggles 7d / 30d
- [ ] T008 Nav/migas admin; denegar vendedor
- [ ] T009 Semilla/emulador + prueba de lectura agregada

## Checkpoint

Un empujón por puesto/día; mostrador no bloqueado; admin ve top 20.
