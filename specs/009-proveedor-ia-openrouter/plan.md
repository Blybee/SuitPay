# Implementation Plan: Proveedor de IA configurable (OpenRouter)

**Branch**: `009-proveedor-ia-openrouter` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-proveedor-ia-openrouter/spec.md`

## Summary

Un módulo `src/server/ia/` elige el proveedor según la modalidad y los interruptores de `config/parametros`. El texto por defecto va a OpenRouter (`chat/completions`, JSON Schema) ya anonimizado. ZiBlay aceptó el 2026-10-20 que ese proveedor entrene con el texto anonimizado, así que la petición no envía `data_collection`. Si esa llamada falla, sigue el cliente Gemini que ya existía. La imagen usa su propio interruptor. Audio, PDF y Compras no salen de Gemini.

## Technical Context

**Language/Version**: TypeScript, mismo stack que 001.

**Primary Dependencies**: TanStack Start `createServerFn`, Zod, Firestore Admin SDK, `fetch` a OpenRouter y al cliente Gemini existente.

**Storage**: dos campos en el documento `config/parametros`. Los ids de modelo viven en variables de entorno, no en Firestore.

**Testing**: Vitest de anonimización, selección y respaldo con `fetch` inyectado. Playwright del bucle de acceso y de Parámetros contra el emulador.

**Target Platform**: navegador admin y servidor de App Hosting.

**Project Type**: extensión de la app SuitPay.

**Constraints**: constitución IV v1.5.0. El nombre del proveedor de emisión no entra en este módulo. Ningún secreto en el cliente.

**Scale/Scope**: un administrador, las tareas de texto que ya existían, una lectura de `indices/clientes` con caché de diez minutos.

## Constitution Check

Puertas derivadas de `.specify/memory/constitution.md` v1.5.0.

| # | Puerta | Verificación | Estado |
|---|--------|--------------|--------|
| I | Aprobación humana indelegable | No se emite ni se escribe un comprobante. Los interruptores los cambia un administrador. | pass |
| II | Ninguna venta se documenta dos veces | No emite. | n/a |
| III | Proveedor de emisión sustituible | No toca el módulo frontera de emisión. | n/a |
| IV | Datos de clientes fuera de IA | Anonimización antes de OpenRouter. El dueño aceptó el 2026-10-20 que el proveedor entrene con ese texto. Guard de `payload.ts`, audio/PDF/Compras en Gemini, respaldo registrado sin el prompt. | pass |
| V | El mostrador no se detiene | 429, 402, 5xx, timeout y JSON inválido caen a Gemini. Sin clave, también. | pass |
| VI | Lo que no se mide no se declara mejorado | El plan no afirma que OpenRouter cotice mejor. `scripts/comparar-ia.ts` compara, no declara una mejora. | pass |
| — | Restricciones del dominio | No hay efecto tributario. | pass |
| — | Disciplina de desarrollo | Pruebas de selección, respaldo y anonimización. No hay emisión, así que no aplica el trío de reintento del proveedor fiscal. | pass |

## Project Structure

```text
specs/009-proveedor-ia-openrouter/
├── spec.md
├── plan.md
└── tasks.md

src/domain/ia/proveedor.ts
src/domain/aprendizaje/compacto.ts
src/server/ia/
src/routes/administracion/parametros.tsx
src/routes/__root.tsx
```

## Complexity Tracking

Ninguna. Se reutilizan `invocarModeloConPartes`, el formulario de Parámetros y `config/parametros`.

## Arreglo incluido (bucle de acceso)

`2cb4d21` pasó a calcular `publica` con `resolvedLocation`. Durante el salto de `/` a `/acceso` la pantalla sigue en `/`, `<Navigate>` se vuelve a montar y el hilo se queda congelado. `vistaDeCascaron` decide lo público con el destino (`location`) y el caso del jefe con la pantalla ya resuelta. El salto a `/acceso` usa `replace`. Si el destino ya es `/fichaje`, no se dispara otro `<Navigate>`.
