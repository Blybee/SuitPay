# Feature Specification: Inventario y almacén

**Feature Branch**: `003-inventario-almacen`

**Created**: 2026-08-10

**Updated**: 2026-09-04 (inventario orientativo permanente; UI en Catálogo; sin motivo)

**Status**: Listo para implementar

**Input**: Contadores por producto que bajan al emitir y suben al anular, avisos de stock bajo, y ajuste administrativo. Depende de `001` (emisión/anulación) y `002` (par y cascada; T021–T025 hechos).

**Governance**: constitución SuitPay v1.2.0. Principios I, II, IV y V: el stock no bloquea la venta; la anulación restaura; no se envían datos de clientes a IA. Copy: nunca «stock real» ni «inventario de registro».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descontar stock al emitir (Priority: P1)

Tras confirmar una emisión exitosa (boleta, factura o nota de venta), el sistema reduce las existencias de cada línea **controlada**. Un reintento con la misma clave no vuelve a descontar. Si después se emite una guía asociada, **no** se descuenta otra vez: la guía hereda el movimiento (`inventarioAplicadoPor` = id de la guía).

**Independent Test**: emitir con dos líneas controladas; el contador de esos códigos bajó una sola vez.

### User Story 2 - Restaurar stock al anular (Priority: P2)

Al anular el mismo día, las cantidades vuelven. Una anulación no se aplica dos veces. En el par boleta/factura ↔ guía, un solo reintegro.

### User Story 3 - Alertas de stock bajo (Priority: P3)

Producto bajo umbral: chip «En alerta» en Catálogo admin; en mostrador, aviso no bloqueante al agregar/emitir (principio V).

### User Story 4 - Carga y ajuste administrativo (Priority: P4)

El administrador fija o resetea la cantidad orientativa de un SKU desde Catálogo (IconButton por fila, carga perezosa). Sin motivo. Traza autor y momento. El jefe lee, no escribe.

### Edge Cases

- Emisión indeterminada: no descontar hasta conocer el resultado (principio II).
- Sin documento `inventario/{codigo}`: sin control; no inventar 0.
- Guía de traslado (sin par): no mueve stock.
- Nota de venta: dueña de su movimiento; nunca escribe el par de asociación.
- Fallo al aplicar inventario: no revierte la emisión.

## Requirements *(mandatory)*

- **FR-001**: Descontar al emitir boleta, factura o nota de venta de forma idempotente. La NV mueve stock igual que bol/fact sin guía.
- **FR-002**: Restaurar al anular el mismo día, idempotente respecto al dueño actual del movimiento.
- **FR-003**: MUST NOT descontar si la emisión no se documentó (rechazo / indisponible sin documento).
- **FR-004**: Advertir stock bajo: `cantidad < (umbral ?? 0.10 * maximo)`.
- **FR-005**: El aviso en mostrador MUST NOT bloquear la emisión.
- **FR-006**: Solo administrador escribe cantidades. Sin motivo. Traza `actualizadoPor` / `actualizadoEn`. Jefe lee.
- **FR-007**: Los contadores son **inventario orientativo permanente**, no sistema de registro. El almacenero no usa SuitPay. El admin resetea cifras aproximadas.
- **FR-008**: Guía asociada MUST NOT descontar otra vez; MUST transferir `inventarioAplicadoPor` a la guía.
- **FR-009**: Cascada bol/fact ↔ guía MUST reintegrar **una sola vez**.
- **FR-010**: Las cantidades MUST vivir en `inventario/{codigo}`, no en `catalogo/actual`. La ficha de producto y el importar viven en `/administracion/catalogo`. MUST NOT haber una segunda página que vuelva a listar los mismos SKUs.

## Success Criteria

- **SC-001**: Cero descuentos dobles tras reintentos con la misma clave.
- **SC-002**: Tras anular el mismo día, el contador vuelve; con par asociado, un solo reintegro.
- **SC-003**: Productos bajo umbral aparecen en «En alerta» el mismo día hábil.
- **SC-004**: Cero descuentos al emitir guía asociada a un origen que ya descontó.

## Assumptions

- Dependencias `001` y `002` T021–T025 están construidas.
- Un SKU sin `inventario/{codigo}` no entra en control hasta que el admin escribe una cantidad.
- Ranking = `004`. Traslado entre almacenes no mueve stock en 003.
