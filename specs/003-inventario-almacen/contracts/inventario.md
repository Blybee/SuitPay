# Contrato — Inventario

**Feature**: `003-inventario-almacen`

## Firestore `inventario/{codigo}`

| Rol | Lectura | Escritura |
| --- | --- | --- |
| Vendedor | sí (getDoc perezoso en mostrador) | no |
| Administrador | sí | no (solo Admin SDK vía server function) |
| Jefe | sí | no |
| Cliente anónimo | no | no |

`allow write: if false` para todos. El backend escribe con Admin SDK.

Al publicar el catálogo, los SKUs que salen del arreglo disparan
`inventario.borrar` (Admin SDK). El cliente no borra existencias.

## Server functions

- `leerInventarioFn` — personal; un código.
- `escribirInventarioFn` — solo administrador; cantidad (y umbral opcional).
- `listarAlertasInventarioFn` — admin/jefe; `alerta == true`.
