# Implementation Plan: Precio de compra orientativo en Catálogo

**Branch**: `007-precio-compra-catalogo` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-precio-compra-catalogo/spec.md`

## Summary

Botón Compras en Catálogo: dropzone efímero → Gemini (o simulado) + compacto `{ id, n, m }` → boceto humano → merge en `inventario/{codigo}`. El panel de cantidad muestra el costo. Sin página nueva, sin Storage, sin colección `compras`.

## Technical Context

**Language/Version**: TypeScript, mismo stack que 001.

**Primary Dependencies**: TanStack Start `createServerFn`, Gemini REST existente (`invocarModeloConPartes`), Zod, Firestore Admin SDK.

**Storage**: Firestore `inventario/{codigo}` con campos opcionales. Medios solo en el body de la server function.

**Testing**: Vitest dominio/servidor; Testing Library para panel, kebab y scroll helper.

**Target Platform**: navegador admin (escritorio y móvil).

**Project Type**: extensión de la app SuitPay.

**Constraints**: constitución IV v1.4.0; techo de archivo alineado a entrenamiento (~8 MiB por medio).

**Scale/Scope**: un admin, facturas ocasionales, ~500 SKUs en el compacto.

## Constitution Check

Puertas derivadas de `.specify/memory/constitution.md` v1.4.0.

| # | Puerta | Verificación | Estado |
|---|--------|--------------|--------|
| I | Aprobación humana indelegable | Extracción = propuesta; Confirmar o Guardar del panel son el write. | pass |
| II | Ninguna venta se documenta dos veces | No emite. | n/a |
| III | Proveedor de emisión sustituible | No toca el módulo frontera. | n/a |
| IV | Datos de clientes fuera de IA | Medio de proveedor + compacto sin precio de venta; medio no se persiste. | pass |
| V | El mostrador no se detiene | El mostrador no depende de Compras. Compacto de venta sin costo. | pass |
| VI | Lo que no se mide no se declara mejorado | El plan no afirma una mejora cuantificada de tiempo de búsqueda. | pass |
| — | Restricciones del dominio | Costo no es inventario de registro ni catálogo de venta. | pass |
| — | Disciplina de desarrollo | Pruebas de merge, simulado, panel y scroll. No hay emisión. | pass |

## Project Structure

```text
specs/007-precio-compra-catalogo/
├── spec.md
├── plan.md
└── data-model.md

src/domain/inventario/          # Existencia + merge
src/server/inventario/          # fijar/parchear conservan costo
src/server/compras/             # extraer + prompts
src/features/compras/           # server fns + panel UI
src/features/inventario/        # PanelCantidad
src/routes/administracion/catalogo.tsx
```

## Complexity Tracking

Ninguna. Se reutiliza el disclosure de Importar, el dropzone, Gemini y `inventario/{codigo}`.
