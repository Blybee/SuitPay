# Contrato — Frontera del proveedor de emisión

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28

Este contrato existe para cumplir el principio III de la constitución: el proveedor de emisión debe poder cambiarse sin reescribir la lógica de venta. Define la interfaz **propia** de SuitPay hacia cualquier proveedor de comprobantes electrónicos.

El módulo que implementa esta interfaz es el **único** lugar del sistema que conoce al proveedor. Ninguna otra parte del código, ni del modelo de datos, ni de la interfaz de usuario menciona su nombre, sus códigos o sus campos.

## Operaciones de la interfaz

| Operación | Entrada (vocabulario de SuitPay) | Salida |
|-----------|----------------------------------|--------|
| `emitir` | tipo de documento, serie, número (o indicación de que lo asigne el proveedor), cliente, líneas con precio con impuesto incluido, condición de pago, formato de impresión | identificación del documento, estado normalizado, enlaces a los archivos generados, o un fallo clasificado |
| `anular` | serie, número, motivo | estado normalizado o fallo clasificado |
| `consultarDocumento` | serie, número | estado normalizado, contenido suficiente para reconciliar (cliente, total, fecha), enlaces a archivos |
| `consultarContribuyente` | tipo y número de documento de identidad | denominación, dirección, ubigeo, condición ante el registro |
| `emitirNotaCredito` | documento de referencia, motivo, líneas | igual que `emitir` |
| `emitirGuiaRemision` | datos del traslado | igual que `emitir`. **Fuera del alcance de esta entrega**, declarada aquí para que la frontera no haya que rediseñarla cuando entre. |
| `crearEstablecimiento` | código de anexo, dirección, ubigeo, nombre y correo opcionales | identificador de establecimiento en el proveedor, o fallo clasificado. **Admin / T083.** |
| `listarEstablecimientos` | — | lista de establecimientos |
| `eliminarEstablecimiento` | identificador de establecimiento | confirmación de baja |
| `crearSerie` | tipo de documento SuitPay, serie (máx. 4), número inicial, identificador de establecimiento | identificador de serie en el proveedor, o fallo clasificado. **Admin / T083.** El mapeo de tipo y los campos del proveedor quedan dentro del adaptador. |
| `eliminarSerie` | identificador de serie en el proveedor | confirmación de baja |

## Normalización de estados

El proveedor expresa el estado con su propio vocabulario y sus propios códigos. La frontera lo traduce al vocabulario de SuitPay, y **solo el vocabulario de SuitPay circula** por el resto del sistema.

| Estado de SuitPay | Significado |
|-------------------|-------------|
| `registrado` | El proveedor aceptó el documento pero la autoridad aún no lo confirmó. |
| `aceptado` | Confirmado por la autoridad. |
| `rechazado` | La autoridad lo rechazó. |
| `anulado` | Baja confirmada. |
| `sin_respuesta_autoridad` | El proveedor lo tiene pero la autoridad no ha respondido. Es un estado normal, no un error. |

El código y el mensaje originales del proveedor se conservan en el objeto aislado de referencias del comprobante, para diagnóstico. **No se muestran al vendedor** y no se usan para decidir nada.

## Clasificación de fallos

Es la parte más importante de esta frontera, porque de ella depende la garantía de no duplicar. Cada fallo del proveedor debe caer en una de estas tres categorías, y la distinción no es cosmética:

**`rechazo_definitivo`** — el proveedor respondió que el documento no es válido. Se sabe con certeza que no se emitió. La venta puede corregirse y volver a intentarse con una clave nueva.

**`indisponible`** — no se pudo contactar al proveedor, o respondió que no puede atender. Se sabe con certeza que no llegó a procesar. La venta queda `pendiente` y se reintentará.

**`indeterminado`** — la llamada se cortó, agotó su tiempo de espera, o respondió de forma que no permite saber si el documento se creó. **Este es el caso peligroso.** La venta queda `indeterminada` y **está prohibido reintentar la emisión**: solo la reconciliación, consultando al proveedor, puede resolverla.

Confundir `indeterminado` con `indisponible` es exactamente el error que produce comprobantes duplicados. Ante la duda, la clasificación correcta es `indeterminado`, que es la conservadora: cuesta una consulta de reconciliación, mientras que la equivocación contraria cuesta un documento fiscal de más y su anulación.

## Requisitos que la frontera debe cumplir

- **Los secretos nunca salen del backend.** El token del proveedor se guarda en el gestor de secretos de la plataforma.
- **Ninguna operación de esta interfaz decide sobre el correlativo.** El correlativo lo gobierna SuitPay en su transacción; la frontera solo lo transporta.
- **Toda invocación se registra** en la traza de intentos del comprobante, con su momento y su resultado, incluidos los fallos. Lo exige la trazabilidad de la constitución.
- **Los tiempos de espera son explícitos y cortos.** Una espera indefinida en el mostrador es peor que un estado indeterminado bien gestionado, porque bloquea al vendedor delante del cliente.
- **La frontera no reintenta por su cuenta.** Reintentar es una decisión de la lógica de emisión, que es la única que conoce el estado del comprobante.

## Dependencia pendiente de confirmar

La interfaz admite enviar el número de comprobante o dejar que lo asigne el proveedor, y esa flexibilidad no es indecisión: es la forma de que el diseño funcione en ambos escenarios.

**Si el proveedor acepta un número explícito**, SuitPay lo envía y la reconciliación es una consulta directa por serie y número.

**Si no lo acepta**, la operación `consultarDocumento` se usa en modo sondeo sobre los números siguientes al último confirmado de la serie, comparando cliente, total y fecha para identificar la venta. Requiere que el proveedor devuelva ese contenido en la consulta, cosa que la investigación del assessment confirmó.

Es la pregunta abierta más valiosa del proyecto y conviene resolverla antes de implementar la emisión, aunque el diseño no se bloquee por ella.

## Cómo se verifica que la frontera es real

La prueba de que el principio III se cumple es sencilla y conviene ejecutarla como revisión: **buscar el nombre del proveedor en todo el repositorio**. Solo debe aparecer dentro del módulo frontera, en su configuración y en la documentación. Cualquier aparición fuera de ahí es una fuga y debe corregirse antes de dar por terminada la tarea.
