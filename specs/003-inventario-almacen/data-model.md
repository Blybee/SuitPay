# Data Model: Inventario y almacén

**Feature**: `003-inventario-almacen` | **Updated**: 2026-09-04

## `inventario/{codigo}`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `codigo` | string | Misma clave que el producto |
| `cantidad` | number | Puede ser negativa |
| `maximo` | number | Primera escritura; un reset de cantidad no lo cambia salvo edición explícita |
| `umbral` | number opcional | Si falta, rige 10% de `maximo` |
| `alerta` | boolean | Persistido: `cantidad < (umbral ?? 0.10 * maximo)` |
| `actualizadoPor` | string | uid |
| `actualizadoEn` | timestamp | |

Sin documento = sin control. No inventar 0.

## Comprobante (flags)

- `inventarioAplicado`: boolean
- `inventarioAplicadoPor`: id del dueño actual (comprobante o guía) o null
- `inventarioRestaurado`: boolean

## Lecturas

- Mostrador: `getDoc` al agregar línea o al emitir (perezoso).
- Admin Catálogo: `getDoc` al abrir el popover de esa fila. Chip «En alerta»: query `alerta == true`.
- Prohibido: meter cantidades en `catalogo/actual` o un `inventario/actual` único.
