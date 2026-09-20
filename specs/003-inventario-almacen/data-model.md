# Data Model: Inventario y almacén

**Feature**: `003-inventario-almacen` | **Updated**: 2026-09-04

## `inventario/{codigo}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `codigo` | string | Misma clave que el producto |
| `cantidad` | number opcional | Puede ser negativa. Ausente = sin control de stock (no inventar 0). |
| `precioCompraCentimos` | number entero opcional | Costo unitario orientativo (céntimos, IGV incluido). Spec `007`. |
| `precioCompraEn` | string `YYYY-MM-DD` opcional | Fecha de la factura de proveedor. Spec `007`. |
| `maximo` | number | Primera escritura de cantidad; un reset de cantidad no lo cambia salvo edición explícita |
| `umbral` | number opcional | Si falta, rige 10% de `maximo` |
| `alerta` | boolean | Persistido solo si hay `cantidad`: `cantidad < (umbral ?? 0.10 * maximo)`. Sin cantidad: `false`. |
| `actualizadoPor` | string | uid |
| `actualizadoEn` | timestamp | |

Sin documento = sin control de cantidad ni costo. No inventar 0. Un documento solo con `precioCompraCentimos` no es control de stock: las ventas no lo descuentan.

Al publicar un catálogo recortado (tacho o importación que deja SKUs fuera),
el servidor MUST borrar `inventario/{codigo}` de cada código que sale. No
dejar documentos huérfanos: el catálogo y la existencia de ese SKU se van
juntos.

## Comprobante (flags)

- `inventarioAplicado`: boolean
- `inventarioAplicadoPor`: id del dueño actual (comprobante o guía) o null
- `inventarioRestaurado`: boolean

## Lecturas

- Mostrador: `getDoc` al agregar línea o al emitir (perezoso).
- Admin Catálogo: `getDoc` al abrir el popover de esa fila. Chip «En alerta»: query `alerta == true`.
- Prohibido: meter cantidades en `catalogo/actual` o un `inventario/actual` único.
