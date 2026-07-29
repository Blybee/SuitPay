# Contrato — Funciones del backend

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28

Interfaz entre el cliente web y el backend. Se describe la forma de las peticiones y respuestas, no su implementación.

**Reglas transversales a todas las funciones invocables:**

- Exigen sesión autenticada. La identidad del vendedor se toma **del token**, nunca de la petición. Un cliente no puede declarar en nombre de quién actúa.
- Verifican que el usuario esté activo y tenga el rol necesario.
- **App Check / atestación de aplicación: fuera de alcance** de esta entrega. La frontera activa es sesión + rol + reglas de Firestore.
- Devuelven errores con un código estable y un mensaje apto para mostrar al vendedor. Nunca propagan el mensaje crudo del proveedor externo.

---

## `emitirComprobante`

La función más importante del sistema. Es el único camino por el que nace un comprobante.

**Rol**: vendedor o administrador.

**Petición**

| Campo | Tipo | Notas |
|-------|------|-------|
| `claveIdempotencia` | cadena | Generada en el cliente al confirmar. **Identifica la intención de venta, no la petición**: un reintento del mismo gesto reutiliza la misma clave. |
| `tipoDocumento` | cadena | Boleta, factura o nota de venta. |
| `cliente` | objeto o nulo | Tipo y número de documento. Nulo significa cliente eventual. |
| `lineas` | arreglo | `codigo`, `cantidad`, `precio` con impuesto incluido. |
| `condicionPago` | objeto | Contado, o crédito con fecha de vencimiento. |
| `medioPago` | objeto | Medio y monto recibido. Referencial. |
| `cotizacionId` | cadena o nulo | Si la venta proviene de una cotización. |
| `capturaId` | cadena o nulo | Si el pedido se capturó por dictado o fotografía. |

**Comportamiento**

1. Valida la petición y recalcula los totales con las reglas del dominio. **Si el total recalculado difiere del que envió el cliente, manda el servidor.**
2. Comprueba el umbral de identificación del comprador: si el importe lo supera y no hay cliente identificado, rechaza sin emitir.
3. Abre una transacción que: busca el comprobante con esa clave; si existe, termina y devuelve su estado sin emitir; si no existe, consume el correlativo de la serie del vendedor (`ultimoNumero + 1`, cuyo origen al crear la serie es `numeroInicial` — FR-031a), crea el comprobante en estado `reclamado` y, cuando venga de una cotización, la marca como `convertida` en el mismo acto.
4. **Solo entonces** invoca al proveedor, a través de su módulo frontera.
5. Actualiza el estado con el resultado y añade la entrada correspondiente a la traza de intentos.

**Respuesta**

| Campo | Notas |
|-------|-------|
| `comprobanteId` | La clave de idempotencia. |
| `estado` | Estado alcanzado. |
| `serie`, `numero` | Numeración asignada. |
| `archivos` | Enlaces al documento imprimible y a sus anexos, si ya existen. |
| `yaExistia` | Verdadero cuando la llamada fue un reintento y no produjo una nueva emisión. Permite al cliente distinguir "emitido ahora" de "ya estaba emitido". |

**Errores de interés**

- `serie_no_configurada`: el vendedor no tiene serie para ese tipo de documento (FR-031).
- `cliente_requerido`: el importe supera el umbral de identificación (FR-021).
- `importe_no_positivo`: alguna línea no puede convertirse en comprobante (FR-013).
- `cotizacion_ya_convertida`: otro dispositivo llegó primero (FR-019).
- `emision_indeterminada`: no se pudo determinar el resultado. **El cliente no debe reintentar**; la venta queda a cargo de la reconciliación.
- `proveedor_no_disponible`: la venta queda `pendiente`; el cliente debe recoger los datos de contacto y ofrecer el documento interno.

---

## `anularComprobante`

**Rol**: vendedor o administrador.

**Petición**: `comprobanteId`, `motivo`.

**Comportamiento**: verifica que el comprobante esté aceptado y que se haya emitido el mismo día; si no, rechaza indicando que corresponde una nota de crédito. Solicita la baja al proveedor, registra motivo, autor y momento en el propio documento, y cambia su estado. **No borra nada.**

**Respuesta**: `estado`, `anulacion`.

**Errores**: `fuera_de_ventana_anulacion` (FR-038), `estado_no_anulable`.

---

## `consultarContribuyente`

**Rol**: vendedor o administrador.

**Petición**: `tipoDocumento`, `numeroDocumento`.

**Comportamiento**: consulta al proveedor los datos oficiales. **No crea el cliente**: devuelve los datos para que el vendedor los revise y confirme, como exige el principio I. Si el registro señala al contribuyente como no habido, la respuesta lo indica de forma explícita para que la interfaz pueda advertirlo.

**Respuesta**: `denominacion`, `direccion`, `ubigeo`, `condicion`, `estado`.

**Errores**: `no_encontrado`, `servicio_no_disponible` — este último no debe bloquear la venta: el vendedor puede escribir los datos a mano (FR-026).

---

## `interpretarCaptura`

Único punto de salida del sistema hacia el servicio de asistencia. Existe tanto por seguridad como para hacer verificable el principio IV.

**Rol**: vendedor o administrador.

**Petición**: `tipo` (audio o imagen), `medioUrl` en Cloud Storage, `candidatos` como lote de productos preseleccionado por la búsqueda difusa del cliente.

**Comportamiento**: construye el payload del modelo **incluyendo únicamente** el medio capturado y el lote de productos. Ningún dato almacenado de clientes entra en el payload. Devuelve, por cada renglón, el texto interpretado y los productos candidatos con su grado de coincidencia, marcando como ambiguos los que no pueda resolver y como pendientes los que no pueda interpretar. **No crea pedidos ni comprobantes.**

Ante error de cuota o límite de solicitudes, conmuta a la segunda credencial configurada. Ante indisponibilidad del servicio, devuelve un error que la interfaz traduce en degradación visible.

**Respuesta**: `capturaId`, `lineas` con `textoOriginal`, `candidatos` y `estadoLinea`.

**Errores**: `medio_ilegible` (FR-044 y el caso límite de la fotografía ilegible), `asistencia_no_disponible` (FR-046).

---

## `importarCatalogo`

**Rol**: administrador exclusivamente.

**Petición**: `contenido` (texto del archivo), `formato` (`json_tienda` | `json` | `documento`), `modo` (`validar` o `publicar`).

**Formato `json_tienda`** (migración desde la tienda virtual):

- Solo se toman marca (`brand`), nombre, variantes y precio **mayorista** (`wholesale`).
- Cada variante es un producto distinto; si hay variantes, se ignora el `unitConfig` del padre.
- Descripción: `{marca} {producto} [{variante}]`. El precio **no** va en el texto.
- Código: `id` de la tienda, o `{id}__{variantId}` si hay variante.
- Precio en céntimos (`wholesale × 100`). Si falta wholesale → `0`.
- Unidad: `NIU`. Paquetes/cajas de la tienda se ignoran.

**Comportamiento**: en modo validar, interpreta y devuelve el resumen sin escribir nada: cuántos productos se reconocieron, cuáles presentan conflicto y, si ya hay catálogo publicado, qué productos son nuevos, cuáles cambian de precio y cuáles desaparecen. En modo publicar, escribe el catálogo **en una sola escritura** e incrementa su versión. Los códigos duplicados **bloquean** la publicación (FR-010).

Escribir los ~700 ítems (tras expandir variantes) como una única escritura no es una optimización menor: escrituras individuales sobre el mismo recurso serían más caras y chocarían con los límites de escritura por documento.

**Respuesta**: `resumen` con los recuentos y las diferencias, `conflictos` con su motivo, y `version` cuando se publica.

**Errores**: `archivo_no_interpretable`, `codigos_duplicados` — este último no se resuelve automáticamente, se informa (FR-010).

---

## `consultarEstadoEmision` (bajo demanda — decisión 10)

Sustituye a la antigua reconciliación programada. Es la contrapartida del principio II sin Cloud Scheduler.

**Rol**: vendedor o administrador.

**Disparo**: acción explícita en la UI cuando un comprobante está `indeterminado` (o desde administración).

**Petición**: identificador del comprobante (o serie+número ya reclamados).

**Comportamiento**: consulta al proveedor con `consultarDocumento`. Si el documento existe, adopta su estado real. Si no existe, el comprobante puede volver a emitirse de forma segura (misma clave). Si no hay certeza, mueve a `requiere_intervencion`.

**Nunca emite**. Solo averigua y corrige el estado.

---

## Lo que deliberadamente no existe

Ausencias que son decisiones, no olvidos:

- **Ninguna función que ejecute instrucciones en lenguaje natural con efectos de escritura.** Los comandos se resuelven contra un catálogo cerrado de consultas. Anular es una función propia, invocada desde una confirmación explícita (principio I, FR-048).
- **Ninguna función que emita sin clave de idempotencia.** No hay camino alternativo.
- **Ningún acceso del cliente al proveedor de emisión.** El cliente no conoce su existencia.
- **Ninguna función de borrado de comprobantes.** No existe la operación.
- **Ningún Cloud Scheduler / `procesarPendientes` / reconciliación periódica.** Decisión 10: reintento manual si el proveedor está caído; consulta bajo demanda si el resultado es ambiguo.
- **Ningún documento interno de contingencia como flujo de mostrador** (FR-050a retirado).
