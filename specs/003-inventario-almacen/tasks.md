# Tasks: Inventario y almacén

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)  
**Prereq**: `001-mostrador-asistido` emisión/anulación operativas.

**BLOQUEO**: ninguna tarea de implementación de código (`T010+`) se ejecuta hasta cerrar FR-007 (fuente de verdad en convivencia). Las tareas T001–T009 son solo Speckit/diseño o quedan en espera.

## Phase 0: Desbloqueo de producto

- [ ] T001 Resolver FR-007 con el negocio: SuitPay fuente de verdad vs contadores orientativos
- [ ] T002 Decidir si stock 0 bloquea emisión o solo avisa (default spec: solo avisa)
- [ ] T003 Fijar umbral default (10% de `maximo` vs mínimo absoluto) en plan/data-model

**Checkpoint**: FR-007 cerrado por escrito en spec (sin NEEDS CLARIFICATION).

## Phase 1: Modelo y dominio (bloqueado hasta T001)

- [ ] T010 Dominio: tipos stock, umbral, aplicación idempotente por comprobante
- [ ] T011 Almacén Firestore + reglas (solo backend escribe cantidades)
- [ ] T012 Admin: carga/ajuste con motivo y traza

## Phase 2: Emisión y anulación

- [ ] T013 Descontar en flujo de emisión (idempotente; cubrir reintento / indeterminado)
- [ ] T014 Restaurar en anulación (idempotente)
- [ ] T015 Pruebas emulador: doble emisión, anular restaura, segunda anulación no-op

## Phase 3: Alertas y UI

- [ ] T016 Lista de alertas admin/jefe
- [ ] T017 Aviso no bloqueante en mostrador al agregar/emitir
- [ ] T018 Quickstart de validación de inventario

## Checkpoint final

Stock consistente con emisiones/anulaciones; alertas visibles; mostrador no detenido por defecto.
