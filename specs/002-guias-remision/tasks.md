# Tasks: Guías de remisión electrónicas

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)  
**Prereq**: feature 001 operativa (emisión, clientes, comandos, frontera).

**Tests**: toda tarea de emisión MUST cubrir reintento, respuesta ausente y fallo del proveedor (constitución). La cascada de anulación (US8) igual, **en ambos sentidos**.

## Phase 0: Contrato y dominio

- [x] T001 Definir tipos SuitPay de guía (modo, motivo, direcciones, transportista, conductor, ítems) en dominio/servidor
- [x] T002 Extender contrato `proveedor-emision` / interfaz TS: entrada/salida de `emitirGuiaRemision` en vocabulario SuitPay
- [x] T003 Modelo Firestore: `transportistas`, `indices/transportistas`; campos de guía en comprobante; `comprobanteOrigenId` / `guiaAsociadaId`; series tipo guía
- [x] T004 Reglas Firestore + pruebas emulador para transportistas (vendedor lee; escribe solo backend/alta controlada)

## Phase 1: Frontera proveedor

- [x] T005 [P] Implementar adaptador `emitirGuiaRemision` (público / privado / entre almacenes) — mapeo solo aquí
- [x] T006 [P] Proveedor simulado: éxito, rechazo, indisponible, indeterminado
- [x] T007 Pruebas de frontera: tres modalidades + clasificación de fallos

## Phase 2: Orquestación de emisión

- [x] T008 `emitirGuia` servidor: validación, reclamo idempotente, invocación frontera, persistencia PDF
- [x] T009 Server function + errores serializables
- [x] T010 Pruebas: doble Emitir, respuesta ausente, fallo proveedor, sin serie

## Phase 3: Transportistas

- [x] T011 Crear transportista (consulta padrón + alta manual) + actualización de índice en TX
- [x] T012 UI alta en contexto / comando `/crear transportista {RUC}` con confirmación
- [x] T013 Búsqueda local desde índice para la papeleta

## Phase 4: Papeleta y comandos

- [x] T014 Registrar `/guia` y `/crear transportista` en `CATALOGO_DE_COMANDOS`
- [x] T015 Papeleta UI: campos condicionales por modo; Emitir explícito
- [x] T016 Cablear `/guia` → abrir papeleta (sin efecto tributario hasta Emitir)
- [x] T016a [US6] Precargar ítems de la papeleta desde el pedido del mostrador (incluye pedido cargado con «Reutilizar pedido» / FR-056 de 001) (FR-011)
- [x] T017 Diálogo post-emisión: Imprimir / Guardar / Compartir PDF (patrón 001)

## Phase 4b: Rechazo SUNAT y recuperación (US7)

- [x] T017b [US7] Cablear toast `sileo.action` al clasificar rechazo definitivo de guía (no en indeterminado ni indisponible). Botón «Volver a Generar». Duración persistente o `0` (FR-012)
- [x] T017c [US7] Recuperar bol/fact + datos de guía en la papeleta; nueva idempotencia; no emitir. Reutilizar el espíritu de `pedidoDesdeComprobante` / FR-056 + campos de traslado del data-model (FR-012)
- [x] T017d [US7] Pruebas: rechazo → toast → recuperar sin emitir; doble clic del toast no duplica intención; indeterminado no muestra este toast; fallo de proveedor / respuesta ausente siguen el contrato de T010 (constitución)

## Phase 5: Verificación punta a punta

- [x] T018 Emulador: emitir guía pública con transportista sembrado
- [x] T019 Emulador: privado + indeterminado → consultar estado
- [x] T020 E2E mínimo Playwright (serie demo + `PROVEEDOR_SIMULADO`)

## Phase 6: Asociación y anulación en cascada bidireccional (US8, 2026-08-18)

- [x] T021 [US6/US8] Al emitir guía desde pedido reutilizado de boleta/factura, persistir `comprobanteOrigenId` en la guía y `guiaAsociadaId` en el origen. MUST NOT asociar nota de venta. MUST NOT haber segunda guía vigente sobre el mismo origen (FR-011, FR-013)
- [x] T022 [US8] Extender `anularComprobante` (`src/server/emision/anular.ts`) con cascada bidireccional: anular boleta/factura anula la guía; anular guía anula el comprobante. Mismo motivo y autor. Guía sin par se anula sola (FR-013, FR-015)
- [x] T023 [US8] Toast informativo (Sileo / `usarNotificaciones`, sin segundo OK) en detalle de boleta/factura **y** de guía al confirmar anular el par (FR-014). Archivos: `src/routes/comprobantes/$comprobanteId.tsx`
- [x] T024 [US8] Pruebas constitución **ambos sentidos**: reintento, respuesta ausente, fallo del proveedor; par `indeterminado` no se presenta como anulado; segundo anular es no-op (FR-015, FR-016)
- [x] T025 [P] [US8] Prueba de no-asociación: nota de venta + guía independiente no escribe el par; traslado entre almacenes se anula solo

## Checkpoint

GRE emitible por papeleta y comando; transportistas reutilizables; frontera sustituible; cero tabs nuevos; rechazo SUNAT recupera papeleta vía toast, sin emitir; par boleta/factura ↔ guía se anula en cascada bidireccional con toast informativo; principios I–III verificados en pruebas.
