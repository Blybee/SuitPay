# Data Model: Inventario y almacén

**Feature**: `003-inventario-almacen` | **Date**: 2026-08-10 | **Updated**: 2026-08-18 (dueño del movimiento / herencia)

## Opción preferida (borrador)

Documento satélite `inventario/actual` (o `inventario/{codigo}`) separado de `catalogo/actual` para no inflar la lectura del catálogo de mostrador si solo se necesitan precios/descripciones.

| Campo | Tipo | Notas |
|-------|------|-------|
| `codigo` | string | Misma clave que producto del catálogo |
| `cantidad` | number | Entero ≥ 0 (o permitir negativo solo si se decide aviso-only) |
| `maximo` | number | Base del umbral: alerta si `cantidad < 0.10 * maximo` (T003, 2026-08-19) |
| `umbral` | number | Override opcional por SKU; si falta, rige el 10% de `maximo` |
| `alerta` | boolean | Derivado o persistido |
| `ajustes` | subcolección o arreglo acotado | motivo, delta, autor, momento |

## Integración con comprobantes

- Tras emisión exitosa de nota de venta, boleta o factura: aplicar deltas negativos una vez. Marcar `inventarioAplicado: true` y `inventarioAplicadoPor` = id de ese comprobante (o ledger por `comprobanteId`).
- Al emitir una guía **asociada** a una boleta/factura que ya aplicó inventario: **no** aplicar deltas otra vez. Actualizar `inventarioAplicadoPor` al id de la guía (herencia). La boleta/factura conserva `inventarioAplicado: true`.
- Tras anulación del dueño actual (o del par en cascada): deltas positivos **una vez** (`inventarioRestaurado: true` en el dueño). El segundo documento del par no vuelve a restaurar.
- Guía sin par (traslado entre almacenes): no mueve stock en esta feature.

## Índices

Consultas admin: `alerta == true` (campo único suele bastar en Standard).

## Lecturas

Mostrador: no descargar inventario completo al arranque; aviso bajo demanda al agregar línea o al emitir (lazy).
