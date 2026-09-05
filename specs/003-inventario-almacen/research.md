# Research: Inventario orientativo

**Feature**: `003-inventario-almacen` | **Date**: 2026-09-04

## Por qué no meter cantidades en `catalogo/actual`

Ese documento lo leen todos los puestos una vez por sesión. El stock se escribe en cada venta. Juntarlos invalidaría la caché del catálogo y concentraría escrituras en un solo doc (hotspot Firestore, ~1 write/s).

## Por qué no `inventario/actual` único

Mismo hotspot: cinco vendedores descontando SKUs distintos competirían por un documento.

## Por qué un doc por código

Vender un codo toca solo `inventario/CODO-12`. SKUs sin doc están sin control.

## Por qué flags en el comprobante y no un ledger

La idempotencia es la clave de emisión. `inventarioAplicado` / `inventarioAplicadoPor` / `inventarioRestaurado` bastan para no descontar ni reintegrar dos veces, incluida la cascada con guía.

## Por qué no motivo en el ajuste

El admin resetea cifras aproximadas; el almacenero no usa SuitPay. Un formulario de merma/conteo/recepción fingiría un almacén de registro.

## Por qué descontar después del proveedor

El comprobante se escribe **antes** de llamar al proveedor (principio II). Descontar en el reclamo movería stock de una venta que puede no existir. Solo `enviado`/`aceptado`, también cuando `consultar-estado` cierra un indeterminado.

## Por qué la UI vive en Catálogo

Una segunda página volvería a listar los mismos SKUs. El popover perezoso (`getDoc` al abrir) es la carga bajo demanda; el chip «En alerta» es otra consulta, no otra lista maestra.
