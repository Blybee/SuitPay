# Tasks: Inventario y almacén

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

El gate de go-live está **retirado**. T001–T003 hechos (orientativo, stock 0 avisa, umbral 10%). T021 de `002` hecho.

## Phase 1: Modelo

- [x] T001 FR-007 orientativo permanente
- [x] T002 stock 0 no bloquea
- [x] T003 umbral 10% de `maximo`
- [x] T010 Dominio aplicar/reintegrar/heredar; flags en comprobante
- [x] T011 Firestore `inventario/{codigo}` + reglas (cliente no escribe)
- [x] T012 Admin: popover en Catálogo, sin motivo; jefe lectura

## Phase 2: Emisión y anulación

- [x] T013 Descontar NV/bol/fact tras venta cerrada (también consultar-estado)
- [x] T014 Restaurar dueño; cascada un reintegro
- [x] T015 Pruebas emulador: doble emisión, anular, segunda anulación no-op
- [x] T019 Fusionado en T010/T013 (herencia guía)

## Phase 3: Alertas y UI

- [x] T016 Chip En alerta en Catálogo
- [x] T017 Aviso no bloqueante en mostrador
- [x] T018 Quickstart

## Phase 4: NV y guía

- [x] T020 Bol/fact → guía no descuenta; anular cualquiera reintegra una vez
- [x] T021 NV dueña propia; no escribe par
