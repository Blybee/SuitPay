# Feature Specification: Guías de remisión electrónicas

**Feature Branch**: `002-guias-remision`

**Created**: 2026-08-09

**Updated**: 2026-08-18 (enmienda: asociación 1:1 boleta/factura ↔ guía; anulación en cascada bidireccional + toast informativo)

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

1. **Given** un pedido cargado desde un comprobante emitido (FR-056), **When** el vendedor inicia `/guia`, **Then** la papeleta puede usar esas líneas como ítems de la guía (sin alterar líneas ni estado del comprobante origen).
2. **Given** esa guía emitida, **When** se consulta el comprobante de boleta/factura original, **Then** sus líneas, totales y estado siguen intactos, y queda escrito el enlace `guiaAsociadaId` (la guía guarda `comprobanteOrigenId`). Son dos intenciones de documento distintas (principio II); la asociación solo habilita la anulación en cascada (US8).

---

### User Story 7 - Recuperar una guía rechazada por SUNAT (Priority: P2)

La guía se rechazó (clasificación `rechazo_definitivo` / `emision_rechazada`). El vendedor no debe copiar de nuevo la boleta/factura ni los datos de traslado. Un toast Sileo con acción «Volver a Generar» reabre la papeleta precargada; el vendedor confirma Emitir. No aplica a `indeterminado` (hay que consultar estado) ni a `indisponible` (es la misma intención).

**Why this priority**: un rechazo deja el correlativo consumido y el trabajo de captura perdido si no se recupera; el mostrador no puede exigir reescribir el mismo traslado.

**Independent Test**: emitir guía → rechazo definitivo → toast «Volver a Generar» → papeleta con bol/fact + traslado → Emitir crea una guía nueva.

**Acceptance Scenarios**:

1. **Given** una guía rechazada de forma definitiva, **When** el vendedor pulsa «Volver a Generar» en el toast, **Then** se abre la papeleta editable con las líneas y el cliente de la boleta/factura origen (si existe) y los campos de traslado de la guía rechazada, y MUST NOT haberse emitido ni invocado al proveedor.
2. **Given** esa papeleta recuperada, **When** el vendedor confirma Emitir, **Then** se reclama una clave de idempotencia nueva (el documento rechazado queda cerrado) y solo entonces se consume un correlativo.
3. **Given** una guía en estado indeterminado o proveedor indisponible, **When** termina el intento, **Then** el sistema MUST NOT mostrar este toast de regenerar (consultar estado o reintentar la misma intención, según el contrato).

---

### User Story 8 - Anular el par boleta/factura ↔ guía (Priority: P2)

El vendedor anula, el mismo día, una boleta o factura que ya tiene guía asociada —o anula la guía—. El otro documento del par se anula en el mismo acto, con el mismo motivo y autor. Un toast informa que el asociado también se anulará; no pide un segundo OK. La confirmación explícita es la del documento que el vendedor tiene abierto (principio I).

**Why this priority**: sin la cascada, queda un documento regulado vigente y el stock (feature `003`) no tiene un único dueño que reintegrar.

**Independent Test**: emitir boleta, emitir guía asociada, anular desde la boleta → ambos anulados + toast; repetir el camino inverso partiendo de la guía; segundo intento es no-op.

**Acceptance Scenarios**:

1. **Given** una boleta o factura con guía asociada vigente, **When** el vendedor confirma anular el comprobante, **Then** un toast (solo notificación) indica que también se anulará la guía, y ambos documentos quedan anulados con el mismo motivo y autor.
2. **Given** una guía asociada a una boleta o factura, **When** el vendedor confirma anular la guía, **Then** un toast indica que también se anulará el comprobante asociado, y ambos quedan anulados con el mismo motivo y autor.
3. **Given** la anulación de uno de los dos queda `indeterminada` ante el proveedor, **When** el vendedor ve el resultado, **Then** el par MUST NOT presentarse como anulado hasta resolver (consultar estado; MUST NOT reintentar a ciegas).
4. **Given** el par ya anulado, **When** se confirma anular de nuevo cualquiera de los dos, **Then** no se vuelve a llamar al proveedor ni se altera el par (no-op idempotente).
5. **Given** una guía de traslado entre almacenes **sin** boleta/factura asociada, **When** se anula, **Then** solo se anula esa guía.

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
- **FR-011**: El flujo de guía MUST poder partir de un pedido ya cargado en el mostrador, incluida la carga vía «Reutilizar pedido» de un comprobante emitido (FR-056 de 001). Al **emitir** la guía, MUST NOT modificar líneas, totales ni estado del comprobante origen. Si el pedido proviene de una boleta o factura (no de una nota de venta), MUST persistir la asociación 1:1: `comprobanteOrigenId` en la guía y `guiaAsociadaId` en el origen. MUST NOT asociar una guía a una nota de venta. MUST NOT haber más de una guía **vigente** asociada al mismo origen.
- **FR-012**: Ante `rechazo_definitivo` / `emision_rechazada` de una guía, el sistema MUST mostrar un toast Sileo `action` persistente (o sin auto-cierre) con botón «Volver a Generar». El clic MUST recuperar líneas y cliente de la boleta/factura origen (si existe; US6) y los campos de traslado de la guía rechazada (direcciones, modo, transportista/conductor, peso/bultos, ítems); MUST abrir la papeleta editable; MUST reclamar una clave de idempotencia nueva (el documento rechazado queda cerrado); MUST NOT emitir ni invocar al proveedor. MUST NOT usarse este toast en `indeterminado` (consultar estado) ni en `indisponible` (reintento de la misma intención).
- **FR-013**: Con asociación vigente, anular la boleta/factura MUST anular también la guía asociada, y anular la guía MUST anular también la boleta/factura asociada. Mismo motivo y autor. MUST NOT quedar uno vigente y el otro anulado. Una guía sin par (p. ej. traslado entre almacenes) se anula sola.
- **FR-014**: Al confirmar anular uno de los dos, el sistema MUST mostrar un toast informativo (Sileo vía `usarNotificaciones`) de que también se anulará el documento asociado. El toast MUST NOT pedir confirmación extra. La confirmación explícita es la del documento abierto (principio I). El toast MUST aparecer en el detalle de boleta/factura **y** en el de guía.
- **FR-015**: Si la anulación de **cualquiera** de los dos queda `indeterminada`, el sistema MUST NOT presentar el par como anulado hasta resolver. MUST NOT reintentar a ciegas. Un segundo intento cuando el par ya está anulado MUST ser no-op (sin nueva llamada al proveedor).
- **FR-016**: La anulación en cascada MUST cubrir en pruebas el reintento, la respuesta ausente y el fallo del proveedor **en ambos sentidos** (constitución: ambos documentos son regulados). El reintegro de stock (una sola vez) lo especifica `003`.

### Key Entities

- **Guía de remisión**: comprobante tipo guía con datos de traslado (modo, motivo, peso, bultos, direcciones, transportista o conductor, ítems) y, si aplica, `comprobanteOrigenId`.
- **Asociación boleta/factura ↔ guía**: enlace 1:1 vigente (`guiaAsociadaId` / `comprobanteOrigenId`) escrito al emitir la guía desde un pedido reutilizado. Habilita la anulación en cascada; no fusiona las dos intenciones de documento.
- **Transportista**: maestro RUC + denominación (+ MTC opcional), reutilizable.
- **Papeleta de guía**: propuesta editable en UI; no es el comprobante hasta Emitir.

## Success Criteria

- **SC-001**: Una guía pública completa se emite en menos de 3 minutos en el puesto.
- **SC-002**: Cero guías duplicadas por doble clic o reintento a ciegas.
- **SC-003**: El 100% de altas de transportista requieren confirmación explícita.
- **SC-004**: El 100% de las anulaciones de un par asociado anulan ambos documentos; cero casos en que uno quede vigente y el otro anulado (salvo guía sin par).

## Assumptions

- La frontera `emitirGuiaRemision` ya está declarada en el contrato de 001; esta feature la implementa. Anular guía reutiliza la frontera `anular` (principio III).
- Los códigos de modo/motivo del proveedor se mapean solo dentro del adaptador.
- No se implementa cola de guías ni tab de historial dedicado en esta entrega (consulta vía patrones de 001 cuando existan).
- Feature 001 permanece el hogar del mostrador; 002 solo añade capacidades de GRE.
- La nota de venta no se asocia a guía. El descuento/reintegro de stock lo especifica `003` (la guía hereda el movimiento; la cascada reintegra una vez).
- A lo sumo una guía vigente por boleta/factura.
