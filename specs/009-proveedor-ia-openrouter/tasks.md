# Tasks: Proveedor de IA configurable (OpenRouter)

**Input**: Design documents from `/specs/009-proveedor-ia-openrouter/`

**Prerequisites**: plan.md, spec.md

**Tests**: incluidos. No hay emisión tributaria, así que no aplica el trío de reintento del proveedor fiscal.

## Phase 1: Cáscara

- [x] T001 Decidir la vista del mostrador con el destino para `/acceso` y la pantalla resuelta para el jefe en `src/features/sesion/cascaron.ts` y `src/routes/__root.tsx`
- [x] T002 Cubrir esa decisión en `tests/unit/features/cascaron-sesion.test.ts` y el recorrido en `tests/e2e/acceso-desde-raiz.spec.ts`

## Phase 2: Anonimización y proveedor

- [x] T003 Ampliar `anonimizarTexto` en `src/domain/aprendizaje/compacto.ts` y cubrir ejemplos peruanos en `tests/unit/domain/aprendizaje-compacto.test.ts`
- [x] T004 Modelar modalidad e interruptores en `src/domain/ia/proveedor.ts`
- [x] T005 Llamar a OpenRouter y caer a Gemini desde `src/server/ia/`
- [x] T006 Enrutar texto, imagen, audio, PDF y Compras por `invocarIa`
- [x] T007 Probar selección, 429, 402, JSON inválido y el cuerpo anonimizado en `tests/unit/server/ia-invocar.test.ts`

## Phase 3: Parámetros

- [x] T008 Persistir `iaTexto` e `iaImagen` en `src/domain/esquemas/comunes.ts` y `src/server/parametros/gestionar.ts`
- [x] T009 Mostrar interruptores e ids en `src/routes/administracion/parametros.tsx`
- [x] T010 Añadir la sonda de OpenRouter al diagnóstico
- [x] T011 Enlazar `OPENROUTER_API_KEY` y los ids en `apphosting.yaml`

## Phase 4: Comparación manual

- [x] T012 Dejar `scripts/comparar-ia.ts` fuera de CI, con casos sintéticos sin datos de cliente
