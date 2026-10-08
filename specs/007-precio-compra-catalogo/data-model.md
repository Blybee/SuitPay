# Data Model: Precio de compra orientativo

**Feature**: `007-precio-compra-catalogo` | **Extiende**: `003-inventario-almacen`

## `inventario/{codigo}`

Campos de 003 más:

| Campo                  | Tipo                         | Notas                                                                                                  |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cantidad`             | number opcional              | Ausente = sin control de stock. MUST NOT inventar 0 al guardar solo costo.                             |
| `precioCompraCentimos` | number entero opcional       | Costo unitario en soles, con IGV ya incluido en el precio de la orden. Ausente = sin costo registrado. |
| `precioCompraEn`       | string `YYYY-MM-DD` opcional | Fecha del comprobante de proveedor, si el modelo o el admin la aportan.                                |
| `monedaCompra`         | `'USD'` opcional             | Solo si el costo vino de dólares. En soles el campo no se escribe.                                     |
| `precioCompraOriginal` | string opcional              | Precio unitario impreso, con su escala (`1.0550`).                                                     |
| `tipoCambio`           | number opcional              | Venta SUNAT usada para pasar a soles. Editable por el administrador antes de confirmar.                |
| `tipoCambioEn`         | string `YYYY-MM-DD` opcional | Fecha de la orden con la que se pidió el tipo de cambio.                                               |

Un documento MAY existir solo con costo (sin `cantidad`). Las ventas MUST ignorarlo para deltas.

`set` completo al fijar cantidad está prohibido: MUST merge para no borrar el costo.

Al publicar un catálogo recortado, el servidor sigue borrando `inventario/{codigo}` de los SKUs que salen (003): el costo de un código desaparecido no se conserva.

## Boceto (no persistido)

```
coincidencias[]: { codigo, precioCompraCentimos?, precioCompraEn?, etiquetaFactura, moneda?, precioOriginal?, tipoCambio?, tipoCambioEn? }
sinMatch[]: { etiquetaFactura, precioCompraCentimos?, precioCompraEn?, moneda?, precioOriginal? }
```

En dólares, `precioCompraCentimos` se calcula al confirmar como `round(precioOriginal × tipoCambio × 100)`. En soles es el precio impreso redondeado al céntimo.

Vive en el cliente hasta Confirmar o Descartar.

## `tiposDeCambio/{fecha}`

Un documento por fecha pedida (`YYYY-MM-DD`). Lo escribe y lo lee solo el servidor. El cliente no tiene regla de lectura.

| Campo            | Tipo      | Notas                       |
| ---------------- | --------- | --------------------------- |
| `venta`          | number    | Tipo de cambio venta SUNAT. |
| `fechaPublicada` | string    | Fecha que devolvió la API.  |
| `guardadoEn`     | timestamp | Momento del cache.          |

Si la API falla no se guarda el fallo. El administrador escribe el tipo de cambio a mano.
