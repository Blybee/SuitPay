# Feature Specification: Proveedor de IA configurable (OpenRouter)

**Feature Branch**: `009-proveedor-ia-openrouter`

**Created**: 2026-10-20

**Status**: Draft

**Input**: Interruptores globales en Parámetros para tareas de texto e imagen, OpenRouter como proveedor de texto por defecto, anonimización antes de enviarlo, y respaldo a Gemini.

**Governance**: constitución de SuitPay v1.5.0. Principios I, II y IV no negociables. Audio, PDF y Compras de Catálogo siguen en Gemini. Ningún dato de cliente sale sin anonimizar cuando el destino es OpenRouter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir el proveedor de texto y de imagen (Priority: P1)

El administrador abre Inicio → Parámetros y ve la sección Inteligencia artificial. Dos interruptores, solo él puede cambiarlos: tareas de solo texto (OpenRouter o Gemini, omisión OpenRouter) y tareas con imagen (OpenRouter o Gemini, omisión Gemini). La sección muestra los ids de modelo en uso. Guardar persiste en `config/parametros`. Al recargar, el valor sigue ahí.

**Why this priority**: sin el interruptor no hay forma de volver a Gemini si OpenRouter no sirve.

**Independent Test**: entrar como administrador, ver omisiones e ids, cambiar el de texto, recargar.

**Acceptance Scenarios**:

1. **Given** un documento de parámetros viejo, **When** el administrador abre la página, **Then** el texto está en OpenRouter y la imagen en Gemini.
2. **Given** que cambia el texto a Gemini y guarda, **When** recarga, **Then** el interruptor sigue en Gemini.
3. **Given** un vendedor, **When** intenta guardar parámetros, **Then** el servidor lo rechaza.

---

### User Story 2 - El texto sale anonimizado y con respaldo (Priority: P1)

Cotizar con texto pegado, la revisión de memoria, el lote y el diagnóstico de texto usan el interruptor de texto. La fotografía y la imagen de un par de entrenamiento usan el de imagen. Audio, PDF y Compras llaman a Gemini. Lo que va a OpenRouter no lleva teléfono, correo, DNI, RUC, dirección ni nombre de cliente. Si OpenRouter responde 429, 402, 5xx, se agota el tiempo o el JSON no cumple el schema, el servidor llama a Gemini y deja un `console.warn` con motivo y modelo, sin el prompt.

**Why this priority**: es el camino que ve el vendedor cuando pega una lista.

**Independent Test**: pruebas de unidad con `fetch` inyectado y textos peruanos de ejemplo.

**Acceptance Scenarios**:

1. **Given** los interruptores por defecto, **When** se invoca una tarea de texto, **Then** la petición va a OpenRouter.
2. **Given** los interruptores por defecto, **When** se invoca una imagen, un audio, un PDF o Compras, **Then** la petición va a Gemini.
3. **Given** OpenRouter responde 429 o 402, **When** la tarea termina, **Then** la respuesta es la de Gemini y el aviso no contiene el prompt.
4. **Given** un texto con DNI, celular `+51`, correo y el nombre de un cliente del índice, **When** se arma el cuerpo hacia OpenRouter, **Then** esos datos no están y el código `TUB-PVC-12` y la cantidad `12` sí.

### Edge Cases

- Un documento `config/parametros` anterior a v1.5.0 no tiene los interruptores: se leen las omisiones.
- Sin `OPENROUTER_API_KEY` el texto cae a Gemini y se registra `sin_clave`.
- Si no se puede leer `indices/clientes`, no se llama a OpenRouter.
- Un código con guion y ocho dígitos (`SKU-12345678`) no se trata como DNI.

## Requirements *(mandatory)*

- **FR-001**: Parámetros MUST persistir `iaTexto` e `iaImagen` en `config/parametros` vía el Admin SDK. Las reglas de Firestore no cambian.
- **FR-002**: Solo el rol administrador MUST poder escribir esos campos.
- **FR-003**: La página MUST mostrar los ids de OpenRouter (texto e imagen) y de Gemini (principal y respaldo) leídos del servidor.
- **FR-004**: Audio, PDF y Compras MUST llamar a Gemini con independencia de los interruptores.
- **FR-005**: El texto enviado a OpenRouter MUST pasar por la anonimización de FR del principio IV v1.5.0. El guard de claves prohibidas de `payload.ts` MUST correr en ese cuerpo.
- **FR-006**: 429, 402, 5xx, timeout y JSON inválido MUST provocar una llamada a Gemini y el `console.warn` indicado.
- **FR-007**: La petición a OpenRouter MUST usar `response_format` JSON Schema. MUST NOT enviar `provider.data_collection`. El dueño aceptó el 2026-10-20 que el proveedor entrene con el texto ya anonimizado.

## Success Criteria *(mandatory)*

- **SC-001**: Un administrador ve los dos interruptores en su omisión y los ids, y un cambio sobrevive a recargar.
- **SC-002**: Las pruebas de unidad fallan si el texto por defecto no llama a OpenRouter, si la imagen por defecto no llama a Gemini, o si un 429 no llama a Gemini.
- **SC-003**: Un ejemplo con DNI, celular, correo, dirección y nombre de cliente no aparece en el cuerpo enviado a OpenRouter, y `TUB-PVC-12` sí.

## Assumptions

- El secreto en Secret Manager se llama `OPENROUTER_API_KEY`, el mismo nombre que la variable, con availability `RUNTIME`.
- El 2026-10-20 el texto por defecto es `nvidia/nemotron-3-super-120b-a12b:free` y la imagen `nvidia/nemotron-3.5-super-vl:free`. Tres llamadas reales de cada uno devolvieron JSON que cumple el schema. El 550B gratuito es más grande, pero no anuncia `structured_outputs` y una de tres respuestas no cumplió el schema.
