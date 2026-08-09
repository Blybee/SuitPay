# Research: Guías de remisión (002)

**Date**: 2026-08-09

## Decision 1 — Superficie UX

**Decision**: comando `/guia` + papeleta/modal; no tab «Guías».

**Rationale**: el intake pedía `/guia`; el endpoint exige ~15 campos. Un tab permanente rompe el modelo Pedido|Cotizaciones|Vecinos|Lista y sobre-invierte en una operación menos frecuente. El patrón de 001 (propuesta incompleta → pedir faltantes → confirmar) ya existe.

**Alternatives**: tab dedicado (reservado si más adelante hay cola/reimpresión diaria).

## Decision 2 — Transportistas

**Decision**: colección `transportistas/{ruc}` + `indices/transportistas` (espejo del patrón clientes).

**Rationale**: en modo público el RUC/denominación se reutiliza; consulta padrón al alta; índice para autocomplete local.

**Conductores**: en v1 van en la papeleta (privado); opcionalmente cachear últimos usados por puesto más adelante — no colección propia.

## Decision 3 — Modalidades

Mapeo conceptual SuitPay → proveedor (solo en adaptador):

| Modo SuitPay | Modo transporte | Notas |
|--------------|-----------------|-------|
| Público | código modo `01` | Requiere transportista (RUC + denominación) |
| Privado | código modo `02` | Requiere conductor (doc, nombres, licencia, placa) |
| Entre almacenes | motivo `04` | Direcciones con anexo; transportista según reglas del adaptador |

Ítems: código, cantidad, descripción, unidad. PDF `a4` por defecto (como comprobantes).

Los cuerpos JSON de ejemplo del proveedor se conservan como referencia **solo** dentro de la documentación/adaptador; el resto del sistema usa tipos SuitPay.

## Decision 4 — Relación con 001

- `emitirGuiaRemision` ya declarado en `specs/001-mostrador-asistido/contracts/proveedor-emision.md`.
- 001 apunta GRE a esta feature; no implementar GRE en el código de 001.
- Reutilizar FR-054a (PDF inmediato) y catálogo de comandos.
