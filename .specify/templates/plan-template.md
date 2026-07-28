# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Puertas derivadas de `.specify/memory/constitution.md` v1.0.0. Marca cada una como
`pass` / `fail` / `n/a` y justifica todo `fail` en Complexity Tracking, o detente y enmienda
la constitución.

| # | Puerta | Verificación | Estado |
|---|--------|--------------|--------|
| I | Aprobación humana indelegable (NO NEGOCIABLE) | ¿Toda emisión pasa por confirmación explícita de un vendedor identificado? ¿Ninguna orden en lenguaje natural produce por sí sola un efecto irreversible? | [ ] |
| II | Ninguna venta se documenta dos veces (NO NEGOCIABLE) | ¿El diseño es idempotente respecto a la intención del vendedor? ¿Se registra la emisión en curso antes de invocar al proveedor? ¿Existe forma de reconciliar una respuesta que no llega, sin reintentar a ciegas? | [ ] |
| III | Proveedor de emisión sustituible | ¿Toda interacción con el proveedor queda detrás de una frontera propia? ¿Ningún concepto suyo se filtra al resto del sistema? | [ ] |
| IV | Datos de clientes fuera de los servicios de IA (NO NEGOCIABLE) | ¿Se envía únicamente información de productos y el contenido que produce el vendedor? ¿La identidad del cliente se resuelve dentro del sistema? | [ ] |
| V | El mostrador no se detiene | ¿La venta se completa si la asistencia automática no responde? ¿La búsqueda de productos es independiente de servicios externos? ¿El pedido en curso sobrevive a un corte de red? ¿La degradación es visible? | [ ] |
| VI | Lo que no se mide no se declara mejorado | ¿Existe línea base para cada mejora que el plan afirma? ¿Las señales cualitativas están etiquetadas como tales? | [ ] |
| — | Restricciones del dominio | ¿Documentos regulados distinguidos de los internos? ¿Nada "se elimina"? ¿Correlativos trazados incluso al fallar? ¿El IGV no se recalcula por cuenta propia? ¿Toda emisión, anulación e intento fallido queda registrado? | [ ] |
| — | Disciplina de desarrollo | ¿Hay pruebas de reintento, respuesta ausente y fallo del proveedor? ¿La integración se ejercita primero en el entorno de demostración? ¿Se respeta el alcance excluido en `concept.md`? | [ ] |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
