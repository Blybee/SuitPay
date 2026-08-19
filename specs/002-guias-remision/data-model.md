# Data Model: Guías de remisión (002)

**Updated**: 2026-08-18 (asociación 1:1 y anulación en cascada bidireccional)

## transportistas/{numeroDocumento}

ID = RUC (11 dígitos).

| Campo | Tipo | Notas |
|-------|------|-------|
| tipoDocumento | `'RUC'` | |
| numeroDocumento | string | = id |
| denominacion | string | |
| numeroRegistroMtc | string? | |
| direccion | string? | |
| creadoEn | timestamp | |
| creadoPor | uid | |

## indices/transportistas

Documento único reducido (solo backend escribe), entradas `{ numeroDocumento, denominacion }` para autocomplete local — mismo espíritu que `indices/clientes`.

## Comprobante tipo guía

Extiende el comprobante de 001 con bloque de traslado (nombres SuitPay):

- modoTransporte: `publico` \| `privado`
- motivoTraslado: enum SuitPay (incluye `entre_almacenes`)
- pesoBruto, unidadPeso, numeroBultos
- direccionPartida / direccionLlegada: `{ ubigeo, direccion, anexo? }`
- transportista?: `{ numeroDocumento, denominacion, numeroRegistroMtc? }`
- conductor?: `{ tipoDocumento, numeroDocumento, nombres, licencia, placa }`
- itemsGuia: `{ codigo, cantidad, descripcion, unidad }[]`
- `comprobanteOrigenId`?: id de la boleta/factura desde la que se reutilizó el pedido (FR-056). Ausente en guía de traslado entre almacenes o guía sin par.

`proveedor.pdf|xml|cdr` igual que otros comprobantes.

## Asociación en el comprobante origen (boleta / factura)

Extiende el documento de 001. **No** aplica a nota de venta.

| Campo | Tipo | Notas |
|-------|------|-------|
| `guiaAsociadaId` | cadena? | Id de la guía vigente. Se escribe al emitir la guía; no altera líneas ni estado. A lo sumo una guía vigente. |

La anulación en cascada (FR-013) usa este par: anular uno anula el otro. Idempotencia: si ambos ya están `anulado`, no-op.

## series

Incluir tipo de documento guía en la configuración de series del vendedor (mismo flujo admin que boleta/factura).
