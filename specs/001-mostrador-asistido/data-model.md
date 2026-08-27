# Phase 1 — Modelo de datos: Mostrador asistido

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28 | **Updated**: 2026-08-18 (marca persistida + `categorias` en el mismo documento)
**Almacenamiento**: Cloud Firestore edición Standard, proyecto Firebase independiente

## Principios de modelado aplicados

El modelo sigue la orientación a documentos de forma estricta y con un objetivo declarado: **minimizar lecturas**. De ahí tres patrones que se repiten.

**Consolidación.** Los datos que siempre se consultan juntos viven en el mismo documento. El comprobante lleva embebidos sus líneas, la instantánea del cliente, la condición de pago, la anulación si la hubo y las referencias del proveedor. No hay subcolecciones para nada de eso.

**Instantáneas de solo lectura.** El catálogo y el índice de clientes se publican como documentos únicos que contienen arreglos completos, pensados para leerse una vez por sesión y buscarse localmente. Con facturación por documento y no por tamaño, un documento grande cuesta lo mismo que uno pequeño.

**Desnormalización deliberada.** El comprobante guarda una copia de los datos del cliente y del producto tal como estaban al emitir. No es redundancia accidental: un comprobante debe reflejar lo que se emitió, no lo que el catálogo diga meses después.

---

## Colecciones

### `catalogo/actual`

Documento único con el catálogo completo. Escrito solo por el backend.

| Campo | Tipo | Notas |
|-------|------|-------|
| `version` | número | Se incrementa en cada publicación. El cliente compara contra su caché. |
| `publicadoEn` | marca de tiempo | |
| `publicadoPor` | cadena | Identificador del administrador. |
| `totalProductos` | número | Para mostrar en la administración sin recorrer el arreglo. |
| `categorias` | arreglo de objetos | Taxonomía de un nivel: `{ id, nombre }`. Vive en el mismo documento para no añadir lecturas (FR-009d, enmienda 2026-08-18). |
| `productos` | arreglo de objetos | El catálogo. Cada elemento: `codigo`, `descripcion` (`{marca} {nombre} [{variante}]`), `marca` (campo persistido; JSON `brand` / PDF `LINEA`; puede ser cadena vacía), `unidad` (p. ej. `NIU`), `precio` mayorista en céntimos con impuesto incluido, `activo`, `categoriaId` (opcional, referencia a `categorias[].id`). |

**Acceso**: una lectura por sesión y dispositivo. El cliente espeja el documento en IndexedDB con su `version` y busca localmente. Los filtros por marca y categoría (global o dentro de una marca) corren sobre ese espejo: cero lecturas extra.

**Límites**: el documento no puede superar 1 MiB. Con ~500 productos se ocupan unos 50 KB, así que hay margen para varios miles. Si algún día se acercara al límite, la salida es fragmentar en `catalogo/fragmento-1..n` manteniendo el mismo patrón de una lectura por fragmento.

**Escritura**: solo al importar o editar el catálogo. Es una escritura poco frecuente y de un único actor, muy lejos del límite de una escritura por segundo por documento.

---

### `clientes/{numeroDocumento}`

Un documento por cliente, **identificado por su número de documento de identidad**. Esa elección es intencionada: permite comprobar la existencia de un cliente con una lectura directa por identificador, sin consulta ni índice.

| Campo | Tipo | Notas |
|-------|------|-------|
| `tipoDocumento` | cadena | Tipo de documento de identidad. |
| `numeroDocumento` | cadena | Igual al identificador del documento. |
| `denominacion` | cadena | Razón social o nombres. |
| `direccion` | cadena | |
| `ubigeo` | cadena | Proveniente de la consulta de contribuyentes. |
| `telefono`, `correo` | cadena | Opcionales. |
| `condicion` | cadena | Estado ante el registro oficial, por ejemplo habido o no habido. Alimenta la advertencia de FR-024. |
| `consultadoEn` | marca de tiempo | Cuándo se trajeron los datos oficiales. |
| `creadoPor`, `creadoEn` | cadena, marca de tiempo | |

**Cliente eventual**: no es un documento. Es un valor por defecto en el pedido, sin identificador, que solo se materializa en el comprobante. Evita un documento artificial y una lectura innecesaria.

---

### `indices/clientes`

Documento único con la lista reducida de clientes, para resolver localmente las coincidencias parciales de razón social que exige FR-025.

| Campo | Tipo | Notas |
|-------|------|-------|
| `version` | número | |
| `clientes` | arreglo de objetos | Cada elemento: `numeroDocumento`, `denominacion`. Nada más. |

**Racional**: unos pocos miles de clientes con solo esos dos campos ocupan del orden de cientos de kilobytes y caben en un documento. Una lectura por sesión sustituye a una consulta por cada búsqueda de cliente.

**Mantenimiento**: el backend añade la entrada al crear un cliente. Es una escritura pequeña y poco frecuente.

---

### `comprobantes/{claveIdempotencia}`

El documento central del sistema. **Su identificador es la clave de idempotencia** generada en el cliente al confirmar la venta, no el número del comprobante. Escrito exclusivamente por el backend.

| Campo | Tipo | Notas |
|-------|------|-------|
| `estado` | cadena | Ver la máquina de estados abajo. |
| `tipoDocumento` | cadena | Boleta, factura o nota de venta. |
| `serie` | cadena | Serie reclamada al emitir. |
| `numero` | número | Correlativo consumido. Nulo mientras no se haya reclamado. |
| `cliente` | objeto | Instantánea al emitir: tipo y número de documento, denominación, dirección. Nulo o marcado como eventual si no se identificó. |
| `lineas` | arreglo de objetos | Cada línea: `codigo`, `descripcion`, `unidad`, `cantidad`, `precio` con impuesto incluido, `importe`. Instantánea, no referencia. |
| `total` | número | |
| `condicionPago` | objeto | `tipo` (contado o crédito), `fechaVencimiento`, `estadoCobro`, `pagos` como arreglo. Embebido, no en colección aparte. El esquema admite crédito a nivel de emisión; **la UX de crédito/cobro y el canal vecinos como módulo de cobranzas quedan fuera de esta entrega** (US8 = cotizaciones de vecino). |
| `medioPago` | objeto | `medio` y `montoRecibido`. Referencial, sin conciliación. |
| `vendedorId`, `emitidoEn` | cadena, marca de tiempo | Atribución exigida por el principio I y FR-027. |
| `proveedor` | objeto | Referencias externas aisladas: identificadores, **URL del PDF** y demás enlaces generados por el proveedor, estado informado, código y mensaje de error. Se persiste el **enlace** (cadena), nunca el binario del PDF en Storage. **Ningún campo del proveedor se usa como campo propio**, por el principio III. |
| `anulacion` | objeto | `motivo`, `autor`, `momento`, `estado`. Embebido. Nulo si no se anuló. |
| `cotizacionId` | cadena | Origen, si vino de una cotización. |
| `capturaId` | cadena | Origen, si vino de un dictado o una fotografía. |
| `intentos` | arreglo de objetos | Cada invocación al proveedor con su momento y su resultado. Es la traza que exige el principio de trazabilidad, incluidos los intentos fallidos. |

#### Máquina de estados

```text
                     +--------------+
                     |  reclamado   |  creado en transacción, correlativo consumido,
                     +------+-------+  proveedor aún no invocado
                            |
          +-----------------+-----------------+
          v                 v                 v
  +--------------+  +----------------+  +----------+
  |   enviado    |  | indeterminado  |  | pendiente|  proveedor caído:
  +------+-------+  +-------+--------+  +----+-----+  consta que no hay doc
         |                  |                |
         |                  | consulta       | reintento manual
         |                  | bajo demanda   | (misma clave)
         |                  v                v
      +--+---+--------+  (adopta estado   enviado / ...
      v      v        v   real o vuelve
 aceptado rechazado  ...  a pendiente)
      |
      v
+----------+
| anulado  |  solo el mismo día (FR-037)
+----------+
```

**Reglas de transición que el diseño garantiza:**

- El documento **se crea antes** de invocar al proveedor. Nunca después. Es la condición que hace imposible el duplicado por reintento en vuelo.
- Una segunda petición con la misma clave encuentra el documento: solo si está `pendiente` reintenta emitir; en cualquier otro estado (incluido `reclamado` en vuelo) devuelve el estado sin emitir de nuevo.
- Desde `indeterminado` **está prohibido** volver a invocar la emisión. Solo se sale por **consulta bajo demanda** (`consultarEstadoEmision`), que pregunta al proveedor y nunca emite.
- `pendiente` es el estado cuando el proveedor está caído y **consta** que no se emitió. El vendedor reintenta a mano con la misma clave (decisión 10 / FR-050).
- `requiere_intervencion` es el destino de una consulta que no pudo determinar qué ocurrió. No se cierra en silencio.
- `anulado` solo es alcanzable el mismo día de la emisión. Después, la corrección es un documento nuevo.
- Ninguna transición borra el documento. La anulación es un cambio de estado.

---

### `series/{serieId}`

Una serie por vendedor y tipo de documento. Documentos pequeños con el contador transaccional.

| Campo | Tipo | Notas |
|-------|------|-------|
| `serie` | cadena | Máximo 4 caracteres, con el prefijo que exige el tipo de documento. |
| `tipoDocumento` | cadena | |
| `vendedorId` | cadena | |
| `numeroInicial` | número | Origen configurado al dar de alta la serie (ej. `0` o `100`). Debe coincidir con el número de arranque registrado en el panel del proveedor. Inmutable tras la primera emisión, o solo editable con procedimiento administrativo explícito. |
| `ultimoNumero` | número | Último correlativo reclamado. Al crear la serie sin emisiones: `numeroInicial - 1` (el siguiente reclamado es `numeroInicial`). Se incrementa en la misma transacción que crea el comprobante. |
| `ultimoNumeroConfirmado` | número | Último correlativo con emisión confirmada. Traza operativa. Al crear la serie: igual que `ultimoNumero`. |
| `activa` | booleano | |

**Origen del contador (volcado 5 / FR-031a)**: no se asume que toda serie empiece en cero. Ejemplos: `numeroInicial = 0` → primer comprobante `F001-0`; `numeroInicial = 100` → `F002-100`.

**Hotspotting**: cada serie pertenece a un solo vendedor, así que su contador recibe como máximo una escritura por venta de esa persona — muy por debajo del límite de una escritura por segundo por documento. Es precisamente el patrón distribuido que la regla de hotspotting recomienda, obtenido gratis por el hecho de que cada vendedor tiene serie propia.

---

### `cotizaciones/{cotizacionId}`

| Campo | Tipo | Notas |
|-------|------|-------|
| `numero` | número | Identificador legible para pedirla por voz o por comando. |
| `estado` | cadena | Solo `pendiente` mientras el documento existe. Los estados `convertida` y `descartada` **quedan retirados** del diseño vigente. |
| `canal` | cadena | `general` (tab Cotizaciones) o `vecino` (tab Vecinos). Por defecto `general`. |
| `aliasVecino` | cadena | Obligatorio si `canal === 'vecino'`; es la etiqueta del tab interno. Ausente en canal general. |
| `telefonoVecino` | cadena | Opcional si `canal === 'vecino'`. Celular para abrir WhatsApp al capturar la lista. Ausente en canal general. |
| `cliente` | objeto | Instantánea, igual que en el comprobante. |
| `lineas` | arreglo de objetos | Con el precio acordado en su momento. Puede estar vacío en una cotización de vecino recién creada. |
| `total` | número | |
| `creadoPor`, `creadoEn` | cadena, marca de tiempo | |
| `actualizadoEn` | marca de tiempo | Útil en cotizaciones vivas de vecino que se reescriben al agregar/quitar líneas. |

**Campos retirados**: `comprobanteId` y `convertidaEn` ya no se escriben. El rastro de origen queda en el comprobante (`cotizacionId`), no en la cotización.

**Transición de conversión (FR-019)**: **borrar en duro** la cotización ocurre **en la misma transacción** que crea el comprobante. Si el documento ya no existe, la emisión se rechaza con error estable (`cotizacion_ya_usada`). Esto impide que dos dispositivos con la misma cotización abierta produzcan dos comprobantes, caso que la clave de idempotencia por sí sola no cubre porque cada dispositivo genera una clave distinta.

**Borrado manual (FR-019a)**: cualquier vendedor autorizado puede eliminar una cotización `pendiente` desde el cliente (con confirmación en UI). Coherente con FR-017 (acceso compartido).

**Advertencia al recuperar** (FR-018): al abrir una cotización, el cliente compara sus líneas contra el catálogo en caché y señala los precios que cambiaron y los productos que ya no existen. No requiere lecturas adicionales.

**Canal vecinos (US8)**: una cotización viva por vecino (`canal: vecino` + `aliasVecino`). El tab Vecinos filtra por canal; el tab Cotizaciones solo lista `canal: general`. `aliasVecino` y `telefonoVecino` se pueden editar mientras la cotización esté pendiente.

---

### `listasRequerimiento/{vendedorId}/dias/{AAAA-MM-DD}`

Un documento por vendedor **y día laboral** (lunes a sábado, día civil Lima). Las líneas van embebidas porque siempre se leen y escriben juntas.

| Campo | Tipo | Notas |
|-------|------|-------|
| `vendedorId` | cadena | Igual al segmento del camino. Dueño; sincroniza entre sus dispositivos. |
| `fecha` | cadena | `AAAA-MM-DD`, igual al id del documento. |
| `lineas` | arreglo | `{ id, codigo, descripcion, cantidad, urgencia: normal\|urgente }`. |
| `actualizadoEn` | marca de tiempo | |
| `caducaEn` | marca de tiempo | TTL Firestore de 1 semana desde la última escritura. El cliente ignora documentos vencidos. |

El tab Lista muestra pills lun–sáb de la semana actual (fecha corta en teléfono); abre en el día actual y **cada día se lee bajo demanda al pulsar su pill** (una lectura por día visitado, nada al arrancar la app). Las altas del buscador/dictado/foto van al día actual.

---

### Medios en Cloud Storage `capturas/{uid}/{id}.{ext}`

Audio: lifecycle 1 día. Fotografía: 7 días. Ver `storage.lifecycle.json` y `docs/CICLO-DE-VIDA-MEDIOS.md`. El historial reproducible del día vive en IndexedDB (almacén `audios`); la UI no borra.

---

### `capturas/{capturaId}`

| Campo | Tipo | Notas |
|-------|------|-------|
| `tipo` | cadena | `audio` o `imagen`. |
| `medioUrl` | cadena | Ubicación del original en Cloud Storage. El original no se guarda en Firestore. |
| `estado` | cadena | `procesando`, `propuesta`, `aprobada`, `descartada`, `ilegible`. |
| `lineas` | arreglo de objetos | Cada elemento: `textoOriginal`, `candidatos` como arreglo, `seleccion`, `estadoLinea` (`resuelta`, `ambigua`, `pendiente`). Es lo que alimenta la revisión contrastada de FR-042 y el marcado de FR-044. |
| `vendedorId`, `creadoEn` | cadena, marca de tiempo | |

**Nunca contiene datos de cliente almacenados.** El texto original puede mencionar un nombre; la identificación se resuelve fuera del modelo.

---

### `usuarios/{uid}`

| Campo | Tipo | Notas |
|-------|------|-------|
| `nombre` | cadena | |
| `rol` | cadena | `vendedor`, `administrador`, `jefe`. Se replica en las reivindicaciones del token para que las reglas lo evalúen sin lecturas. |
| `activo` | booleano | Desactivar impide emitir (FR-003). |
| `seriesAsignadas` | arreglo de cadenas | |

---

### `config/parametros`

Documento único, una lectura por sesión.

| Campo | Tipo | Notas |
|-------|------|-------|
| `umbralIdentificacionBoleta` | número | 700. Vive aquí y no en el código precisamente porque es de origen regulatorio y puede cambiar por norma. |
| `ventanaAnulacion` | cadena | `mismo_dia`. |
| `formatoImpresionPorDefecto` | cadena | `a4`. |

---

## Índices compuestos necesarios

Con la edición Standard los índices de campo único se crean automáticamente; solo hacen falta los compuestos.

| Colección | Campos | Para |
|-----------|--------|------|
| `comprobantes` | `emitidoEn` desc | Listado colaborativo por día/rango (US4b); página Hoy y rango sin filtro de autor. |
| `comprobantes` | `cliente.numeroDocumento` asc, `emitidoEn` desc | Últimos comprobantes de un cliente (US9) y filtro cliente ± Hoy/rango (US4b). |
| `comprobantes` | `serie` asc, `numero` asc | Búsqueda exacta por serie y número (US4b). Si el id del doc no es serie-número, este índice (o un campo `claveSerieNumero`) lo habilita. |
| `comprobantes` | `vendedorId` asc, `emitidoEn` desc | Atribución / reportes por emisor; **ya no** es el camino de ACL del listado US4b. |
| `comprobantes` | `estado` asc, `emitidoEn` asc | Consultas administrativas por estado (no hay barrido programado; decisión 10). |
| `comprobantes` | `cliente.numeroDocumento` asc, `condicionPago.estadoCobro` asc | Reservado si más adelante se consulta cobro embebido; **no usado por US8 en esta entrega**. |
| `cotizaciones` | `canal` asc, `estado` asc, `creadoEn` desc | Listar pendientes por canal (tab Cotizaciones = `general`; tab Vecinos = `vecino`). |

**Paginación**: todas las listas se recorren con cursores. No se usa desplazamiento por posición, que factura los documentos omitidos.

**Recuentos**: cualquier cifra agregada que haga falta se obtiene con la consulta de agregación de recuento del servidor, nunca descargando documentos para contarlos.

---

## Estrategia de lecturas por sesión

El coste de arrancar y operar una jornada, expresado en lecturas de documentos:

| Momento | Lecturas | Notas |
|---------|----------|-------|
| Arranque de sesión | 3 | `catalogo/actual`, `indices/clientes`, `config/parametros`. Se sirven desde caché local si la versión no cambió. |
| Búsqueda de producto | 0 | Local sobre el catálogo en caché. |
| Búsqueda de cliente por nombre | 0 | Local sobre el índice en caché. |
| Comprobar si un cliente existe | 1 | Lectura directa por identificador, sin consulta. |
| Armar el pedido | 0 | IndexedDB. |
| Emitir | 2 escrituras en una transacción | Comprobante y contador de serie. |
| Consultar comprobantes de un cliente | 1 por comprobante mostrado | Con cursor y página corta. |
| Comprobantes → Hoy | 1 por comprobante del día | Sin paginar; necesario para el total de cierre (US4b). |
| Comprobantes → rango | 20 por página | Cursores; cliente opcional (AND). |
| Comprobantes → serie/número | 1 | Lectura exacta; si falta URL PDF, 0 lecturas extra de Firestore + 1 consulta al proveedor. |

La consecuencia práctica es que un día completo de venta consume del orden de unas pocas decenas de lecturas por dispositivo, muy dentro de la cuota gratuita diaria. El diseño no está optimizado por avaricia sino porque la alternativa —consultar el catálogo en cada tecleo— habría sido a la vez más lenta, más cara y dependiente de la red donde el principio V exige que no lo sea.
