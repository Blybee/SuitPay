# Feature Specification: Inventario y almacén

**Feature Branch**: `003-inventario-almacen`

**Created**: 2026-08-10

**Status**: Draft — **implementación bloqueada** hasta cerrar la fuente de verdad en convivencia con el sistema anterior

**Input**: Requerimiento de lógica de almacén, disminución de stock tras emitir boleta/factura/nota de venta, y alertas de stock bajo. Depende de `001-mostrador-asistido` (emisión y anulación).

**Governance**: constitución SuitPay v1.0.0. Principios I, II, IV y V aplican: el stock no bloquea la venta sin criterio explícito; la anulación restaura existencias; no se envían datos de clientes a IA.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descontar stock al emitir (Priority: P1)

Tras confirmar una emisión exitosa (boleta, factura o nota de venta), el sistema reduce las existencias de cada línea vendida. Un reintento con la misma clave de idempotencia no vuelve a descontar.

**Why this priority**: sin el descuento, el resto del inventario es teatro.

**Independent Test**: emitir un comprobante con dos líneas y verificar que el stock de esos códigos bajó exactamente esas cantidades una sola vez.

**Acceptance Scenarios**:

1. **Given** un producto con stock 10, **When** se emite un comprobante con cantidad 3, **Then** el stock queda en 7.
2. **Given** una emisión ya registrada (misma clave de idempotencia), **When** se reintenta, **Then** el stock no se descuenta otra vez.
3. **Given** nota de venta, boleta o factura, **When** la emisión alcanza estado emitido/aceptado según las reglas de `001`, **Then** el descuento aplica a los tres tipos.

---

### User Story 2 - Restaurar stock al anular (Priority: P2)

Al anular un comprobante el mismo día, las cantidades vuelven al stock. Una anulación no se aplica dos veces.

**Why this priority**: simétrico al descuento; evita inventario fantasma tras correcciones del mostrador.

**Independent Test**: emitir, anular, verificar stock restaurado; segunda anulación no suma de más.

**Acceptance Scenarios**:

1. **Given** un comprobante emitido hoy que descontó stock, **When** se anula, **Then** las cantidades se restauran.
2. **Given** un comprobante ya anulado, **When** se intenta anular de nuevo, **Then** el stock no cambia.

---

### User Story 3 - Alertas de stock bajo (Priority: P3)

Cuando un producto queda por debajo del umbral configurado, el sistema advierte al admin/jefe y, en mostrador, muestra un aviso no bloqueante al vender (principio V: el mostrador no se detiene).

**Why this priority**: valor operativo; depende de stock fiable.

**Independent Test**: bajar stock bajo el umbral y ver alerta; emitir con stock 0 sigue permitiendo la venta con aviso (salvo que se decida lo contrario al desbloquear).

**Acceptance Scenarios**:

1. **Given** umbral por defecto (10% del máximo registrado o mínimo fijo documentado en plan), **When** el stock cruza el umbral a la baja, **Then** el producto queda marcado en alerta.
2. **Given** un producto en alerta, **When** el vendedor lo agrega al pedido, **Then** ve un aviso visible y puede continuar.

---

### User Story 4 - Carga y ajuste administrativo (Priority: P4)

El administrador carga existencias iniciales y puede ajustar cantidades con motivo (merma, conteo, recepción).

**Why this priority**: sin carga inicial no hay descuento útil.

**Independent Test**: admin fija stock de un SKU y queda reflejado en catálogo/almacén.

**Acceptance Scenarios**:

1. **Given** un catálogo publicado, **When** el admin carga o ajusta stock con motivo, **Then** la cantidad queda persistida y trazada (autor, momento, motivo).

---

### Edge Cases

- Emisión indeterminada: no descontar hasta conocer el resultado (alineado al principio II).
- Producto sin campo de stock (aún no cargado): tratar como “sin control” y no inventar cantidades.
- Convivencia con sistema anterior: ver Assumptions / NEEDS CLARIFICATION.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST descontar stock al emitir boleta, factura o nota de venta de forma idempotente respecto a la clave de emisión.
- **FR-002**: El sistema MUST restaurar stock al anular el mismo día, de forma idempotente respecto al acto de anulación.
- **FR-003**: El sistema MUST NOT descontar stock en emisiones que no llegaron a documentarse (rechazo definitivo / indisponible sin documento).
- **FR-004**: El sistema MUST advertir stock bajo según umbral configurable (default documentado en plan: 10% del máximo o mínimo absoluto).
- **FR-005**: El aviso de stock bajo en mostrador MUST NOT bloquear la emisión por defecto (principio V), salvo decisión explícita posterior.
- **FR-006**: Solo administrador (o rol con permiso de almacén) MUST poder cargar/ajustar stock con motivo y traza.
- **FR-007**: [NEEDS CLARIFICATION: ¿SuitPay es fuente de verdad de stock durante la convivencia con el sistema anterior, o los contadores son solo orientativos?]

## Success Criteria

- **SC-001**: Cero descuentos dobles tras reintentos de emisión con la misma clave (muestra de 100 reintentos en pruebas).
- **SC-002**: Tras anular el mismo día, el stock vuelve al valor previo a esa venta.
- **SC-003**: El 100% de productos bajo umbral aparecen en la lista de alertas admin el mismo día hábil.

## Assumptions

- Depende de emisión/anulación de `001`.
- **Implementación bloqueada** hasta resolver FR-007 (fuente de verdad).
- El almacenero no usa SuitPay (`PRODUCT.md`); la carga la hace admin.
- Ranking de ventas es feature `004` y no sustituye al inventario.
