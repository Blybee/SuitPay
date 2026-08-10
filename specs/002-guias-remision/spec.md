# Feature Specification: Guías de remisión electrónicas

**Feature Branch**: `002-guias-remision`

**Created**: 2026-08-09

**Status**: Draft

**Input**: Emisión de guías de remisión (transporte público, privado y traslado entre almacenes) vía la frontera del proveedor; maestros de transportistas; comando `/guia` con papeleta de confirmación. Depende del mostrador asistido (`001-mostrador-asistido`).

**Governance**: sujeta a la constitución de SuitPay v1.0.0. Principios I, II y IV son no negociables. El nombre y los campos del proveedor de emisión MUST permanecer dentro del módulo frontera (principio III).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Emitir guía de remisión con transporte público (Priority: P1)

El vendedor arma el traslado de mercadería que irá con una empresa de transporte. Indica cliente (destinatario), transportista (RUC), direcciones de partida y llegada, peso/bultos, motivo y las líneas. Confirma explícitamente. El sistema emite la guía, conserva la trazabilidad e idempotencia, y ofrece el PDF.

**Why this priority**: es el caso más frecuente de envío con terceros y valida punta a punta la frontera `emitirGuiaRemision`.

**Independent Test**: con serie de guía asignada, transportista registrado y pedido de líneas, se emite una guía modo transporte público y se obtiene PDF sin duplicar correlativo.

**Acceptance Scenarios**:

1. **Given** un vendedor con serie de guía y un transportista registrado, **When** completa la papeleta (cliente, partida, llegada, peso, ítems) y confirma Emitir, **Then** se crea el comprobante de guía antes de invocar al proveedor y se obtiene número + PDF.
2. **Given** una emisión en curso, **When** el vendedor pulsa Emitir dos veces, **Then** solo existe una guía (idempotencia).
3. **Given** respuesta ausente del proveedor, **When** el estado queda indeterminado, **Then** el sistema ofrece consultar estado y MUST NOT reemitir a ciegas.

---

### User Story 2 - Emitir guía con transporte privado (Priority: P2)

El traslado lo hace un conductor propio o contratado (placa, licencia, DNI). No se exige empresa de transporte; sí conductor y placa.

**Why this priority**: segundo modo regulado; reutiliza la misma papeleta con campos condicionales.

**Independent Test**: emitir guía modo privado con conductor y placa válidos.

**Acceptance Scenarios**:

1. **Given** modo transporte privado, **When** faltan conductor o placa, **Then** el sistema impide emitir e indica lo que falta.
2. **Given** datos completos de conductor y direcciones, **When** el vendedor confirma, **Then** se emite la guía y se ofrece el PDF.

---

### User Story 3 - Traslado entre almacenes (Priority: P3)

Movimiento interno entre puntos de la misma empresa (motivo traslado entre establecimientos), con anexos de partida/llegada.

**Why this priority**: menos frecuente; cierra el tercer cuerpo de la API del proveedor.

**Independent Test**: emitir guía motivo traslado entre almacenes con anexos.

**Acceptance Scenarios**:

1. **Given** motivo traslado entre almacenes, **When** se confirman partida/llegada con anexo, **Then** la guía se emite sin exigir cliente externo si el flujo regulado no lo requiere, o con los datos mínimos que exija la frontera normalizada.

---

### User Story 4 - Maestros de transportistas (Priority: P4)

El vendedor da de alta empresas de transporte (RUC) reutilizables, con consulta al padrón y confirmación, análogo a clientes.

**Why this priority**: evita reescribir RUC/denominación en cada guía pública.

**Independent Test**: alta de transportista por RUC y selección en la papeleta de guía.

**Acceptance Scenarios**:

1. **Given** un RUC de transportista no registrado, **When** el vendedor confirma el alta (comando o UI), **Then** queda en `transportistas/{ruc}` y en el índice reducido.
2. **Given** transportistas registrados, **When** se arma una guía pública, **Then** puede elegirse por búsqueda local sin nueva consulta al padrón.

---

### User Story 5 - Iniciar guía por comando `/guia` (Priority: P5)

Desde el buscador, `/guia` (incompleto o con atajos) abre la papeleta pidiendo lo que falta. Nunca emite por el solo hecho de escribir el comando.

**Why this priority**: encaja con el mostrador de una sola entrada; el tab dedicado se descarta.

**Independent Test**: escribir `/guia`, completar papeleta, confirmar emisión.

**Acceptance Scenarios**:

1. **Given** el buscador, **When** el vendedor elige `/guia` del catálogo, **Then** se abre la papeleta de contexto sin haber emitido nada.
2. **Given** la papeleta incompleta, **When** pulsa Emitir, **Then** el sistema pide los campos faltantes.
3. **Given** `/crear transportista {RUC}`, **When** confirma la propuesta, **Then** se crea el maestro (principio I).

---

### User Story 6 - Partir de un pedido ya documentado (Priority: P2)

El cliente ya tiene boleta o factura y, al recoger, pide además la guía porque el envío es a provincia. El vendedor reutiliza las líneas desde el comprobante emitido (FR-056 de `001-mostrador-asistido`) y abre la papeleta `/guia` sobre ese pedido, sin recapturar mercadería.

**Why this priority**: es el caso de uso que motiva la reutilización del pedido; la guía no debe exigir volver a teclear el mismo listado.

**Independent Test**: comprobante emitido → Reutilizar pedido → `/guia` con las mismas líneas precargadas en la papeleta.

**Acceptance Scenarios**:

1. **Given** un pedido cargado desde un comprobante emitido (FR-056), **When** el vendedor inicia `/guia`, **Then** la papeleta puede usar esas líneas como ítems de la guía (sin alterar el comprobante origen).
2. **Given** esa guía emitida, **When** se consulta el comprobante de boleta/factura original, **Then** sigue intacto (principio II: son dos intenciones de documento distintas).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST emitir guías de remisión electrónicas solo tras confirmación explícita de un vendedor identificado (principio I).
- **FR-002**: La emisión de guía MUST reclamar el comprobante/idempotencia antes de invocar al proveedor (principio II). Pruebas de reintento, respuesta ausente y fallo del proveedor son obligatorias.
- **FR-003**: Toda interacción HTTP con el proveedor para guías MUST vivir en el adaptador detrás de `emitirGuiaRemision` (vocabulario SuitPay en el resto del sistema).
- **FR-004**: El sistema MUST soportar modos de transporte público y privado, y motivo de traslado entre almacenes, con campos condicionales validados en servidor.
- **FR-005**: El sistema MUST mantener la colección `transportistas/{ruc}` y el documento índice `indices/transportistas` (solo backend escribe el índice).
- **FR-006**: El comando `/guia` MUST registrarse en `CATALOGO_DE_COMANDOS` y resolverse en papeleta; MUST NOT emitir sin confirmación.
- **FR-007**: El comando `/crear transportista {RUC}` MUST resolverse como propuesta a confirmar; alta con consulta de padrón y fallback manual (mismo espíritu que clientes).
- **FR-008**: Tras emitir, el diálogo MUST ofrecer Imprimir / Guardar / Compartir el PDF cuando la respuesta lo traiga (alineado a FR-054a de 001).
- **FR-009**: MUST existir serie configurada para tipo guía; sin serie, impedir emisión con mensaje claro.
- **FR-010**: MUST NOT añadir un tab permanente «Guías» en esta entrega; la superficie es comando + papeleta/modal.
- **FR-011**: El flujo de guía MUST poder partir de un pedido ya cargado en el mostrador, incluida la carga vía «Reutilizar pedido» de un comprobante emitido (FR-056 de 001). MUST NOT modificar ni anular el comprobante origen al emitir la guía.

### Key Entities

- **Guía de remisión**: comprobante tipo guía con datos de traslado (modo, motivo, peso, bultos, direcciones, transportista o conductor, ítems).
- **Transportista**: maestro RUC + denominación (+ MTC opcional), reutilizable.
- **Papeleta de guía**: propuesta editable en UI; no es el comprobante hasta Emitir.

## Success Criteria

- **SC-001**: Una guía pública completa se emite en menos de 3 minutos en el puesto.
- **SC-002**: Cero guías duplicadas por doble clic o reintento a ciegas.
- **SC-003**: El 100% de altas de transportista requieren confirmación explícita.

## Assumptions

- La frontera `emitirGuiaRemision` ya está declarada en el contrato de 001; esta feature la implementa.
- Los códigos de modo/motivo del proveedor se mapean solo dentro del adaptador.
- No se implementa cola de guías ni tab de historial dedicado en esta entrega (consulta vía patrones de 001 cuando existan).
- Feature 001 permanece el hogar del mostrador; 002 solo añade capacidades de GRE.
