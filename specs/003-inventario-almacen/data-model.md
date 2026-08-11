# Data Model: Inventario y almacén

**Feature**: `003-inventario-almacen` | **Date**: 2026-08-10

## Opción preferida (borrador)

Documento satélite `inventario/actual` (o `inventario/{codigo}`) separado de `catalogo/actual` para no inflar la lectura del catálogo de mostrador si solo se necesitan precios/descripciones.

| Campo | Tipo | Notas |
|-------|------|-------|
| `codigo` | string | Misma clave que producto del catálogo |
| `cantidad` | number | Entero ≥ 0 (o permitir negativo solo si se decide aviso-only) |
| `maximo` | number | Para umbral %; opcional si umbral es absoluto |
| `umbral` | number | Opcional override por SKU |
| `alerta` | boolean | Derivado o persistido |
| `ajustes` | subcolección o arreglo acotado | motivo, delta, autor, momento |

## Integración con comprobantes

- Tras emisión exitosa: aplicar deltas negativos una vez (marcar `inventarioAplicado: true` en el comprobante o ledger por `comprobanteId`).
- Tras anulación: deltas positivos una vez (`inventarioRestaurado: true`).

## Índices

Consultas admin: `alerta == true` (campo único suele bastar en Standard).

## Lecturas

Mostrador: no descargar inventario completo al arranque; aviso bajo demanda al agregar línea o al emitir (lazy).
