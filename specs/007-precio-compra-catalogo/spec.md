# Feature Specification: Precio de compra orientativo en Catálogo

**Feature Branch**: `007-precio-compra-catalogo`

**Created**: 2026-09-19

**Status**: Draft

**Input**: En Administración → Catálogo, el administrador sube facturas de proveedor (PDF o imagen); el modelo propone precios de compra por SKU; tras confirmar se guardan en `inventario/{codigo}` y se ven en el panel de cantidad orientativa.

**Governance**: constitución de SuitPay v1.4.0. Principios I, II y IV no negociables. El medio de la factura MAY ir al modelo y MUST NOT persistirse. El costo MUST NOT viajar en `catalogo/actual` ni en el compacto de asistencia del mostrador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar factura y confirmar costos (Priority: P1)

Un administrador en `/administracion/catalogo` pulsa Compras, suelta uno o más PDF o imágenes de facturas de proveedor, revisa el boceto (SKU, costo, fecha) y Confirma. Los costos quedan en el documento de inventario del SKU.

**Why this priority**: es el dato que hoy se busca en papel y retrasa cotizaciones grandes.

**Independent Test**: modo simulado; un PDF produce coincidencias editables; Confirmar escribe `precioCompraCentimos`; Descartar no escribe.

**Acceptance Scenarios**:

1. **Given** Catálogo con productos publicados, **When** el admin abre Compras y no hay archivo, **Then** Confirmar no envía.
2. **Given** un boceto con un SKU del catálogo, **When** Confirma, **Then** `inventario/{codigo}` tiene `precioCompraCentimos` y no se crea objeto en Storage.
3. **Given** un boceto, **When** el admin cambia el costo y Confirma, **Then** persiste el valor editado, no el crudo del modelo.
4. **Given** líneas de factura sin SKU, **When** extrae, **Then** se listan aparte y no se escriben al confirmar coincidencias.

---

### User Story 2 - Ver y editar el costo en el panel (Priority: P1)

Al pulsar el icono de cantidad de una fila, el panel muestra cantidad orientativa y precio de compra (ambos opcionales). Guardar persiste lo que hay sin inventar el campo vacío.

**Why this priority**: el costo tiene que consultarse en el mismo sitio que la cifra de almacén.

**Independent Test**: documento solo con costo (sin cantidad); el panel muestra el costo y cantidad vacía; una venta no descuenta 0.

**Acceptance Scenarios**:

1. **Given** un SKU con costo y sin cantidad, **When** abre el panel, **Then** ve el precio de compra y «sin control de cantidad».
2. **Given** cantidad y costo, **When** guarda solo un cambio de costo, **Then** la cantidad no cambia.
3. **Given** costo cargado, **When** deja el campo vacío y guarda, **Then** el costo desaparece del documento.

---

### User Story 3 - Barra de Catálogo en móvil y scroll al panel (Priority: P2)

En viewport estrecho, En alerta, Nuevo, Importar y Compras viven en un menú kebab; Guardar queda visible. Al pulsar el icono de cantidad, el scroller de la página (`main`) sube al tope para ver el panel entero.

**Why this priority**: en móvil la barra se satura y el panel queda fuera de vista si solo se mueve la tabla.

**Independent Test**: viewport &lt; md: kebab con esas acciones; Guardar fuera. Clic en cantidad: `main.scrollTop === 0`.

**Acceptance Scenarios**:

1. **Given** viewport móvil, **When** abre el kebab, **Then** ve En alerta (si aplica), Nuevo, Importar y Compras, no Guardar.
2. **Given** la grilla desplazada, **When** pide cantidad de un SKU, **Then** el `main` (no la tabla) hace scroll al inicio.

---

### Edge Cases

- Archivo mayor al techo inline: error visible, no se sube a Storage.
- MIME distinto de PDF/JPEG/PNG/WebP: rechazo.
- Código que el modelo inventa y no está en el catálogo: va a sin match.
- Mismo SKU en dos archivos del lote: gana la fecha de factura más reciente.
- Jefe puede ver Catálogo y el panel; no ve Compras ni Guardar (solo administrador escribe).
- Abrir Compras cierra Importar y viceversa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Catálogo MUST mostrar un botón Compras que abre un disclosure con dropzone múltiple PDF/imagen, el mismo patrón visual que Importar.
- **FR-002**: Los archivos MUST enviarse al servidor en memoria (base64) y MUST NOT persistirse en Storage ni en Firestore.
- **FR-003**: La extracción MUST usar catálogo compacto `{ id, n, m }` sin precio de venta ni `clientes`.
- **FR-004**: El resultado MUST ser un boceto editable; el write a inventario solo ocurre al confirmar.
- **FR-005**: `inventario/{codigo}` MAY tener `precioCompraCentimos` (entero) y `precioCompraEn` (fecha de factura). Ambos opcionales.
- **FR-006**: Fijar cantidad MUST NOT borrar el costo. Fijar costo MUST NOT inventar cantidad 0.
- **FR-007**: Una venta MUST ignorar documentos sin campo `cantidad` numérico.
- **FR-008**: PanelCantidad MUST mostrar y guardar precio de compra junto a la cantidad.
- **FR-009**: En viewport &lt; md, En alerta, Nuevo, Importar y Compras MUST agruparse en un overflow menu; Guardar (o Publicar/Cancelar en revisión) permanece visible.
- **FR-010**: Al pedir cantidad, el scroller de página MUST ir al tope; la tabla virtualizada no es ese scroller.
- **FR-011**: El compacto de foto, dictado y Cotizar MUST NOT incluir `precioCompraCentimos`.

### Key Entities

- **Existencia**: documento `inventario/{codigo}`; cantidad orientativa opcional; costo de compra opcional.
- **Boceto de compras**: lista transitoria en cliente (coincidencias + sin match) hasta confirmar o descartar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador carga una factura de prueba y confirma un costo en menos de 2 minutos (sin buscar papel).
- **SC-002**: Tras confirmar, abrir el panel del SKU muestra el costo sin recargar la app.
- **SC-003**: Ningún objeto nuevo aparece en el bucket de Storage tras una carga de Compras.

## Assumptions

- El administrador es quien escribe; el jefe consulta.
- Cada carga es un disparo: no hay archivo histórico que reconsultar.
- Los precios de factura se interpretan con IGV incluido, en céntimos, como el resto de importes.
- No hay rol `contador` distinto.
