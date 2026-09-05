# Guía de validación — Inventario orientativo

**Feature**: 003-inventario-almacen

## Prerrequisitos

Catálogo publicado con al menos dos SKUs. Sesión admin y vendedor. Emuladores o nube demo.

## Escenarios

1. En Catálogo, abrir el IconButton de un producto, fijar cantidad 10, guardar. Copy: cifra orientativa, no «stock real».
2. Como jefe, abrir el mismo popover: se ve, no se guarda.
3. Como vendedor, agregar esa línea: aviso si está bajo umbral o en 0; se puede emitir.
4. Emitir nota de venta con cantidad 3: el popover muestra 7.
5. Reintentar la misma clave: sigue en 7.
6. Anular el mismo día: vuelve a 10.
7. Chip «En alerta» lista SKUs bajo umbral.
8. Un SKU sin cantidad fijada: sin aviso de inventario; emitir no inventa un 0.
