# Data Model: Guías de remisión (002)

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

`proveedor.pdf|xml|cdr` igual que otros comprobantes.

## series

Incluir tipo de documento guía en la configuración de series del vendedor (mismo flujo admin que boleta/factura).
