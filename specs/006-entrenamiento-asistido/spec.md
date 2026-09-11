# Feature Specification: Entrenamiento supervisado en Aprendizaje

**Feature Branch**: `006-entrenamiento-asistido`

**Created**: 2026-09-10

**Status**: Draft

**Input**: Par de referencia (pedido del cliente vs cotización oro) en Administración → Aprendizaje; alias, etiquetas y priors de marca; unificar el prompt de Cotizar/foto/dictado; conservar `textoOriginal` al guardar cotización.

**Governance**: constitución de SuitPay v1.3.0. Principios I, II y IV no negociables. Emparejado semántico de Cotizar se mantiene (Gemini + catálogo compacto). Fuse.js permanece en la búsqueda escrita (principio V). El prior de marca no nace de comprobantes emitidos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrenar con un par de referencia (Priority: P1)

Un administrador o jefe abre `/administracion/aprendizaje`, sube a un lado el pedido del cliente (PDF, imagen o texto) y al otro la cotización terminada, pulsa Procesar par, revisa alineaciones y priors, y Confirmar es el único paso que escribe `aprendizaje/memoria`.

**Why this priority**: es la forma de enseñar jerga y marcas comerciales con cotizaciones históricas.

**Independent Test**: ambos lados con texto; propuesta con cobertura; Confirmar persiste alias; una alineación `omitido` no crea alias.

**Acceptance Scenarios**:

1. **Given** la página Aprendizaje, **When** falta un lado, **Then** Procesar par no envía.
2. **Given** una propuesta, **When** el admin quita una alineación y Confirma, **Then** esa alineación no entra a memoria.
3. **Given** 10 renglones de pedido y 7 en la cotización oro, **When** procesa, **Then** ve cobertura 7/10 y los 3 restantes no generan alias.

---

### User Story 2 - Cotizar usa marca, alias y priores (Priority: P1)

Foto, dictado y Cotizar reciben el compacto `{ id, n, m, a, e }` y un bloque de priores. El PDF de Cotizar usa las mismas reglas de emparejado que la foto. `textoOriginal` se conserva verbatim.

**Why this priority**: sin esto el admin enseña y el mostrador sigue empatando a ciegas.

**Independent Test**: el prompt serializado incluye `m` y no pide normalizar medidas dentro de `textoOriginal`; un renglón sin match sale con `codigo=""`.

**Acceptance Scenarios**:

1. **Given** compacto con alias `codo media`, **When** Cotizar interpreta ese coloquial, **Then** el modelo recibe `a[]` con instrucción de usarlo.
2. **Given** el cliente no nombra marca, **When** hay prior Pavco en esa familia, **Then** el prompt indica preferir esa marca; si nombra otra, no la corrige.
3. **Given** Cotizar solo texto, **When** arma el prompt, **Then** el encabezado no finge una fotografía.

---

### User Story 3 - Señal viva al guardar cotización (Priority: P2)

Al guardar una cotización nacida de Cotizar o captura, el par usa el `textoOriginal` del requerimiento, no la descripción de catálogo.

**Why this priority**: el lote diario de 005 no aprende jerga si el par ya viene canónico.

**Independent Test**: línea con `textoOriginal: "codo de media"` y descripción de catálogo distinta; el par registrado lleva el coloquial.

---

### Edge Cases

- Un solo medio por lado (solo texto o solo archivo) es válido; ningún medio en un lado no.
- Código emparejado que no está en el catálogo publicado se trata como `no_en_catalogo` y no genera alias.
- Asistencia simulada sin texto parseable: cobertura vacía, no escribe.
- Gemini caído: toast de error; el mostrador no se toca (principio V).
- Los medios del par no se persisten en Storage ni Firestore.

## Requirements *(mandatory)*

- **FR-001**: `/administracion/aprendizaje` MUST ofrecer dos zonas de carga (pedido y cotización oro) reutilizando la drop zone de Cotizar, más texto opcional por lado.
- **FR-002**: Procesar par MUST NOT escribir `aprendizaje/memoria`. Confirmar MUST ser el único write de alias, etiquetas y priors.
- **FR-003**: Solo alineaciones `emparejado` MAY generar alias. `omitido` y `no_en_catalogo` MUST NOT crear alias hacia un SKU próximo.
- **FR-004**: El compacto de asistencia MUST incluir `m` (marca). MAY inyectarse `prioresDeMarca` por familia. MUST NOT incluir precio, stock ni ficha de cliente.
- **FR-005**: Foto, dictado y Cotizar MUST compartir las reglas de emparejado. El prompt de entrenamiento MUST vivir aparte.
- **FR-006**: `textoOriginal` en matching en vivo MUST ir verbatim. La tabla de medidas solo aplica al match interno.
- **FR-007**: Al guardar cotización, el par MUST usar `textoOriginal` de la interpretación cuando exista.
- **FR-008**: El prior de marca MUST incrementarse al Confirmar pares oro y, en el lote diario, a partir del SKU aprobado. MUST NOT incrementarse al emitir un comprobante.
- **FR-009**: Medios de entrenamiento MAY ir al modelo. MUST NOT persistirse. MUST NOT escribir `clientes/{id}`.
- **FR-010**: Acceso MUST ser administrador o jefe. El vendedor MUST NOT entrar.

### Key Entities

- **Alineación**: texto del pedido, código, marca, estado, aliases y etiquetas propuestos.
- **Prior de marca**: contador `n` y `peso = n + 1` por familia y marca en `aprendizaje/memoria`.
- **Sesión de entrenamiento**: auditoría opcional (cobertura, diffs, uid, día Lima) con TTL 3 días, sin archivos.

## Success Criteria

- **SC-001**: Un admin completa un par de referencia (procesar → revisar → confirmar) sin salir de Aprendizaje.
- **SC-002**: Un renglón omitido en la cotización oro no aparece como alias de otro producto.
- **SC-003**: Tras confirmar, el compacto de Cotizar incluye el alias nuevo y la marca del SKU.
