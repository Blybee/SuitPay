# Tasks: Guías de remisión electrónicas

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)  
**Prereq**: feature 001 operativa (emisión, clientes, comandos, frontera).

**Tests**: toda tarea de emisión MUST cubrir reintento, respuesta ausente y fallo del proveedor (constitución).

## Phase 0: Contrato y dominio

- [ ] T001 Definir tipos SuitPay de guía (modo, motivo, direcciones, transportista, conductor, ítems) en dominio/servidor
- [ ] T002 Extender contrato `proveedor-emision` / interfaz TS: entrada/salida de `emitirGuiaRemision` en vocabulario SuitPay
- [ ] T003 Modelo Firestore: `transportistas`, `indices/transportistas`; campos de guía en comprobante; series tipo guía
- [ ] T004 Reglas Firestore + pruebas emulador para transportistas (vendedor lee; escribe solo backend/alta controlada)

## Phase 1: Frontera proveedor

- [ ] T005 [P] Implementar adaptador `emitirGuiaRemision` (público / privado / entre almacenes) — mapeo solo aquí
- [ ] T006 [P] Proveedor simulado: éxito, rechazo, indisponible, indeterminado
- [ ] T007 Pruebas de frontera: tres modalidades + clasificación de fallos

## Phase 2: Orquestación de emisión

- [ ] T008 `emitirGuia` servidor: validación, reclamo idempotente, invocación frontera, persistencia PDF
- [ ] T009 Server function + errores serializables
- [ ] T010 Pruebas: doble Emitir, respuesta ausente, fallo proveedor, sin serie

## Phase 3: Transportistas

- [ ] T011 Crear transportista (consulta padrón + alta manual) + actualización de índice en TX
- [ ] T012 UI alta en contexto / comando `/crear transportista {RUC}` con confirmación
- [ ] T013 Búsqueda local desde índice para la papeleta

## Phase 4: Papeleta y comandos

- [ ] T014 Registrar `/guia` y `/crear transportista` en `CATALOGO_DE_COMANDOS`
- [ ] T015 Papeleta UI: campos condicionales por modo; Emitir explícito
- [ ] T016 Cablear `/guia` → abrir papeleta (sin efecto tributario hasta Emitir)
- [ ] T017 Diálogo post-emisión: Imprimir / Guardar / Compartir PDF (patrón 001)

## Phase 5: Verificación punta a punta

- [ ] T018 Emulador: emitir guía pública con transportista sembrado
- [ ] T019 Emulador: privado + indeterminado → consultar estado
- [ ] T020 E2E mínimo Playwright (serie demo + `PROVEEDOR_SIMULADO`)

## Checkpoint

GRE emitible por papeleta y comando; transportistas reutilizables; frontera sustituible; cero tabs nuevos; principios I–III verificados en pruebas.
