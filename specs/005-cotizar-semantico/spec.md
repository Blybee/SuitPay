# Feature Specification: Cotizar semántico, notas por cliente y 2 workspaces de Pedido

**Feature Branch**: `005-cotizar-semantico`

**Created**: 2026-08-29

**Status**: Draft

**Input**: Emparejado semántico (catálogo compacto + Gemini), Cotizar multimodal, notas de instrucción por cliente, dos workspaces de Pedido, aprendizaje diferido con consolidación, TTL de lotes y monitor admin.

**Governance**: constitución de SuitPay v1.2.0. Principios I, II y IV no negociables. Búsqueda escrita local (principio V). El lote de aprendizaje no escribe `clientes/{id}`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dos workspaces de Pedido (Priority: P1)

El vendedor atiende a dos clientes a la vez. Junto al tab Pedido hay un icon button: `+` abre el segundo workspace y muestra `2`; el clic conmuta `1` ↔ `2`. Cada workspace conserva líneas, cliente, tipo de documento, modo cotización y captura en revisión.

**Why this priority**: desbloquea el mostrador en demanda alta sin split pane.

**Independent Test**: armar líneas distintas en 1 y 2; conmutar; recargar; ambos persisten.

**Acceptance Scenarios**:

1. **Given** un solo workspace, **When** pulsa `+`, **Then** el activo es 2 y el icono muestra `2`.
2. **Given** dos workspaces, **When** pulsa el icono, **Then** conmuta al otro y el número mostrado es el activo.
3. **Given** el slot 2 vacío tras emitir o vaciar, **When** queda sin líneas, **Then** se colapsa y vuelve `+`.

---

### User Story 2 - Cotizar con PDF, imagen y texto (Priority: P1)

En Cotizaciones el botón se llama Cotizar. La zona acepta PDF o imagen y un textarea (WhatsApp). Archivo y texto pueden ir juntos. Combobox de cliente con notas CRUD. Al revisar, el tipo de documento es Cotización. La lista de revisión scrollea.

**Why this priority**: es la entrada diaria de listas de cliente.

**Independent Test**: pegar texto sin archivo; subir imagen; ambos; notas de un cliente registrado; revisión con más líneas que el viewport.

**Acceptance Scenarios**:

1. **Given** asistencia disponible, **When** pulsa Cotizar, **Then** abre la zona de carga (PDF e imagen) y puede revelar el textarea.
2. **Given** archivo y/o texto, **When** envía, **Then** el tab sigue usable y al revisar el selector está en Cotización.
3. **Given** un cliente con notas, **When** lo elige, **Then** ve las notas y puede editarlas o borrarlas.

---

### User Story 3 - Emparejado semántico (Priority: P1)

Foto, dictado y Cotizar envían al modelo un catálogo compacto (sin precio) y, si hay, notas anónimas. Fuse.js permanece en el buscador escrito. El vendedor confirma en revisión (principio I).

**Why this priority**: Fuse no entiende “codo de media”.

**Independent Test**: captura con catálogo compacto; payload sin PII ni precio; código inventado queda pendiente.

---

### User Story 4 - Aprendizaje diferido y monitor admin (Priority: P2)

Al aprobar captura o guardar cotización se persisten pares. Al día siguiente (idle / focus, sin Scheduler) un lote envía memoria vigente + pares, consolida y escribe `aprendizaje/memoria`. Los lotes caducan a 3 días. Admin ve memoria y lotes en `/administracion/aprendizaje`.

**Why this priority**: calidad a largo plazo sin una llamada por venta.

**Independent Test**: registrar pares; procesar lote dos veces (segunda no-op); alias ya presente no se duplica; `caducaEn` +3 días; vendedor no entra a la página admin.

### Edge Cases

- Un solo medio (solo texto o solo archivo) es válido; ninguno no.
- El `+` no anida un botón dentro del tab (HTML inválido).
- Revisiones pendientes no caducan hasta procesarse.
- Si Gemini o el caché fallan, el vendedor escribe (principio V).
- Notas con dígitos de documento se anonimizan antes del modelo.

## Requirements *(mandatory)*

- **FR-001**: MUST haber como máximo 2 workspaces de Pedido, persistidos en IndexedDB, con conmutación por icon button.
- **FR-002**: Cotizar MUST aceptar PDF, imagen y texto; MAY combinar archivo + texto.
- **FR-003**: Al revisar desde Cotizar, el modo de cabecera MUST ser cotización.
- **FR-004**: `RevisionCaptura` MUST scrollear cuando la lista no cabe.
- **FR-005**: Emparejado de captura/Cotizar MUST usar catálogo compacto en el servidor; Fuse MUST NO usarse en ese camino.
- **FR-006**: Payload de asistencia MUST NOT incluir PII ni precio; notas MUST ir sin identidad.
- **FR-007**: Pares al aprobar/guardar; lote idempotente al cambio de día Lima con consolidación de memoria vigente.
- **FR-008**: `lotesAprendizaje` MUST llevar `caducaEn` a 3 días; `aprendizaje/memoria` MUST NOT caducar.
- **FR-009**: `/administracion/aprendizaje` MUST ser lectura para administrador y jefe; MUST NOT ser accesible a vendedor.

## Success Criteria

- **SC-001**: Un vendedor alterna dos pedidos sin perder líneas al recargar.
- **SC-002**: Una lista de WhatsApp pegada produce propuesta revisable sin PDF.
- **SC-003**: El lote del día siguiente no duplica un alias ya presente en memoria.
