# Data Model: Precio de compra orientativo

**Feature**: `007-precio-compra-catalogo` | **Extiende**: `003-inventario-almacen`

## `inventario/{codigo}`

Campos de 003 más:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `cantidad` | number opcional | Ausente = sin control de stock. MUST NOT inventar 0 al guardar solo costo. |
| `precioCompraCentimos` | number entero opcional | Costo unitario con IGV, en céntimos. Ausente = sin costo registrado. |
| `precioCompraEn` | string `YYYY-MM-DD` opcional | Fecha del comprobante de proveedor, si el modelo o el admin la aportan. |

Un documento MAY existir solo con costo (sin `cantidad`). Las ventas MUST ignorarlo para deltas.

`set` completo al fijar cantidad está prohibido: MUST merge para no borrar el costo.

Al publicar un catálogo recortado, el servidor sigue borrando `inventario/{codigo}` de los SKUs que salen (003): el costo de un código desaparecido no se conserva.

## Boceto (no persistido)

```
coincidencias[]: { codigo, precioCompraCentimos, precioCompraEn?, etiquetaFactura }
sinMatch[]: { etiquetaFactura, precioCompraCentimos?, precioCompraEn? }
```

Vive en el cliente hasta Confirmar o Descartar.
