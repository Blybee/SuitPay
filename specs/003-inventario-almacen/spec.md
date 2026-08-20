# Feature Specification: Inventario y almacén

**Feature Branch**: `003-inventario-almacen`

**Created**: 2026-08-10

**Updated**: 2026-08-19 (FR-007 cerrado: contadores orientativos en convivencia)

**Status**: Draft — **implementación bloqueada** hasta cerrar la fuente de verdad en convivencia con el sistema anterior

**Input**: Requerimiento de lógica de almacén, disminución de stock tras emitir boleta/factura/nota de venta, herencia del movimiento cuando hay guía asociada (`002`), y alertas de stock bajo. Depende de `001-mostrador-asistido` (emisión y anulación) y de `002-guias-remision` (asociación y cascada).

**Governance**: constitución SuitPay v1.0.0. Principios I, II, IV y V aplican: el stock no bloquea la venta sin criterio explícito; la anulación restaura existencias; no se envían datos de clientes a IA.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descontar stock al emitir (Priority: P1)

Tras confirmar una emisión exitosa (boleta, factura o nota de venta), el sistema reduce las existencias de cada línea vendida. Un reintento con la misma clave de idempotencia no vuelve a descontar. Si después se emite una guía asociada a esa boleta/factura, **no** se descuenta otra vez: la guía hereda el movimiento (`inventarioAplicadoPor` pasa a ser el id de la guía).

**Why this priority**: sin el descuento, el resto del inventario es teatro.

**Independent Test**: emitir un comprobante con dos líneas y verificar que el stock de esos códigos bajó exactamente esas cantidades una sola vez.

**Acceptance Scenarios**:

1. **Given** un producto con stock 10, **When** se emite un comprobante con cantidad 3, **Then** el stock queda en 7.
2. **Given** una emisión ya registrada (misma clave de idempotencia), **When** se reintenta, **Then** el stock no se descuenta otra vez.
3. **Given** nota de venta, boleta o factura, **When** la emisión alcanza estado emitido/aceptado según las reglas de `001`, **Then** el descuento aplica a los tres tipos.
4. **Given** una boleta o factura que ya descontó stock, **When** se emite una guía asociada, **Then** el stock no baja otra vez; el dueño del movimiento pasa a ser la guía.

---

### User Story 2 - Restaurar stock al anular (Priority: P2)

Al anular un comprobante el mismo día, las cantidades vuelven al stock. Una anulación no se aplica dos veces. Si hay par boleta/factura ↔ guía (cascada de `002`), da igual por cuál documento se inicie: el reintegro ocurre **una sola vez**.

**Why this priority**: simétrico al descuento; evita inventario fantasma tras correcciones del mostrador.

**Independent Test**: emitir, anular, verificar stock restaurado; segunda anulación no suma de más. Con par asociado: anular desde la boleta o desde la guía restaura una vez.

**Acceptance Scenarios**:

1. **Given** un comprobante emitido hoy que descontó stock (sin guía), **When** se anula, **Then** las cantidades se restauran.
2. **Given** un comprobante ya anulado, **When** se intenta anular de nuevo, **Then** el stock no cambia.
3. **Given** una boleta/factura con guía asociada (la guía es dueña del movimiento), **When** se anula cualquiera de los dos (cascada bidireccional de `002`), **Then** el stock se reintegra una sola vez.
4. **Given** ese par ya anulado y el stock ya reintegrado, **When** el otro documento del par también queda anulado por la cascada, **Then** el stock no se suma otra vez.

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
- Convivencia con sistema anterior: SuitPay muestra contadores **orientativos**; el sistema previo sigue siendo la fuente de verdad hasta el go-live de almacén (FR-007).
- Guía de traslado entre almacenes (sin boleta/factura): fuera de esta regla de stock; `003` es un solo almacén.
- Nota de venta: nunca tiene guía asociada; siempre es dueña de su propio movimiento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST descontar stock al emitir boleta, factura o nota de venta de forma idempotente respecto a la clave de emisión. La nota de venta MUST mover stock igual que boleta/factura sin guía (documento interno; no llama al proveedor).
- **FR-002**: El sistema MUST restaurar stock al anular el mismo día, de forma idempotente respecto al acto de anulación del **dueño actual** del movimiento.
- **FR-003**: El sistema MUST NOT descontar stock en emisiones que no llegaron a documentarse (rechazo definitivo / indisponible sin documento).
- **FR-004**: El sistema MUST advertir stock bajo según umbral configurable (default documentado en plan: 10% del máximo o mínimo absoluto).
- **FR-005**: El aviso de stock bajo en mostrador MUST NOT bloquear la emisión por defecto (principio V), salvo decisión explícita posterior.
- **FR-006**: Solo administrador (o rol con permiso de almacén) MUST poder cargar/ajustar stock con motivo y traza.
- **FR-007**: Durante la convivencia con el sistema anterior, los contadores de SuitPay son **orientativos** (indicative inventory), no la fuente de verdad del almacén. El almacenero no opera en SuitPay (`PRODUCT.md`); el stock físico y los ajustes oficiales siguen en el sistema previo. SuitPay puede mostrar existencias y alertas para apoyar al mostrador, pero MUST NOT afirmarse como inventario de registro hasta que el negocio declare el corte (go-live de almacén). Esta decisión **cierra** el `NEEDS CLARIFICATION` de 2026-08-10; el código de `T010+` sigue bloqueado hasta ese corte y hasta `002` T021.
- **FR-008**: Si una boleta o factura ya descontó stock y después se asocia una guía, el sistema MUST NOT descontar otra vez. MUST transferir la titularidad del movimiento a la guía (`inventarioAplicadoPor` = id de la guía).
- **FR-009**: La anulación en cascada del par boleta/factura ↔ guía (`002` FR-013) MUST reintegrar stock **una sola vez**, da igual por cuál documento se inició. MUST NOT reintegrar al anular el segundo del par.

## Success Criteria

- **SC-001**: Cero descuentos dobles tras reintentos de emisión con la misma clave (muestra de 100 reintentos en pruebas).
- **SC-002**: Tras anular el mismo día, el stock vuelve al valor previo a esa venta. Con par asociado, un solo reintegro aunque se anulen ambos documentos.
- **SC-003**: El 100% de productos bajo umbral aparecen en la lista de alertas admin el mismo día hábil.
- **SC-004**: Cero descuentos al emitir una guía asociada a una boleta/factura que ya descontó (herencia).

## Assumptions

- Depende de emisión/anulación de `001` y de la asociación/cascada de `002`.
- **Implementación bloqueada** hasta el corte de go-live de almacén (FR-007 cerrado: contadores orientativos en convivencia). Esta enmienda (2026-08-19) cierra FR-007 por escrito; **no** desbloquea `T010+`.
- El almacenero no usa SuitPay (`PRODUCT.md`); la carga la hace admin.
- Ranking de ventas es feature `004` y no sustituye al inventario.
- Traslado entre almacenes (guía sin venta) queda fuera del movimiento de stock de esta feature.
